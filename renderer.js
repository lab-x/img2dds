const dxt = require('dxt')
const fs = require('fs')
const THREE = require('./three.js')
const dat = require('./dat.gui.js')
require('./DDSLoader.js')

let config = {
	algo:'DXT5',
	compressionQuality:'hight',
	colorMetric:'perceptual',
	weightColourByAlpha:false,
	transparent:false
}

gui = new dat.GUI()
gui.add(config,'algo',['DXT1','DXT3','DXT5'])
gui.add(config,'compressionQuality',['low','normal','hight'])
gui.add(config,'colorMetric',['perceptual','uniform'])
gui.add(config,'weightColourByAlpha')
gui.add(config,'transparent')

let infos = document.querySelector("#infos");

function ParseFile(file) {
	console.clear()
	infos.innerHTML =
		"<p>File information: <strong>" + file.name +
		"<br/></strong> type: <strong>" + file.type +
		"<br/></strong> size: <strong>" + file.size +"</strong> bytes</p>"

	let reader = new FileReader()
	reader.onload = function (e) {
		let img = new Image()
		img.onload = function(){
			document.body.appendChild(img)
			infos.innerHTML+='---------------<br/>compressing, please wait.<br/>'
			const start = Date.now()
			let canvas = document.createElement('canvas')
			canvas.width = img.width
			canvas.height = img.height
			let ctx = canvas.getContext('2d')
			ctx.drawImage(img,0,0)
			let imageData = ctx.getImageData(0, 0, img.width, img.height)
			let data = imageData.data

			if(!config.transparent){
				data = getRGB(data)
			}

			let header = ""
			header += "DDS "//magic number
			header += int32ToFourCC(124)//size header, have to be 124
			header += int32ToFourCC(calculatePitch(img.width*img.height,config.transparent?32:24))//pitch
			header += int32ToFourCC(img.width)//width
			header += int32ToFourCC(img.height)//height
			header += int32ToFourCC(0)// ?
			header += int32ToFourCC(0)// ?
			header += int32ToFourCC(0)//mipmapCount
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			header += int32ToFourCC(0)// unused
			let pfFlags = 0x4
			if(config.transparent){ pfFlags |= 0x1 }
			header += int32ToFourCC(pfFlags)//off_pfFlags
			header += config.algo//off_pfFourCC
			if(config.transparent){
				header += int32ToFourCC(32)//off_RGBBitCount
				header += int32ToFourCC(0xFF000000)//off_RBitMask
				header += int32ToFourCC(0xFF0000)//off_GBitMask
				header += int32ToFourCC(0xFF00)//off_BBitMask
				header += int32ToFourCC(0xFF)//off_ABitMask
			}
			else{
				header += int32ToFourCC(24)//off_RGBBitCount
				header += int32ToFourCC(0xFF0000)//off_RBitMask
				header += int32ToFourCC(0xFF00)//off_GBitMask
				header += int32ToFourCC(0xFF)//off_BBitMask
				header += int32ToFourCC(0)//off_ABitMask
			}
			header += int32ToFourCC(0x1000)//off_caps : for special texture
			header += int32ToFourCC(0)//off_caps2 : for cubemap
			header += int32ToFourCC(0)//off_caps3
			header += int32ToFourCC(0)//off_caps4
			let headerBuffer = Buffer.from(header)

			let flag = 0
			switch(config.algo){
				case "DXT1": flag |= dxt.kDxt1; break;
				case "DXT3": flag |= dxt.kDxt3; break;
				case "DXT5": flag |= dxt.kDxt5; break;
			}
			switch(config.compressionQuality){
				case "low": flag |= dxt.kColourRangeFit; break;
				case "normal": flag |= dxt.kColourClusterFit; break;
				case "hight": flag |= dxt.kColourIterativeClusterFit; break;
			}
			switch(config.colorMetric){
				case "perceptual": flag |= dxt.kColourMetricPerceptual; break;
				case "uniform": flag |= dxt.kColourMetricUniform; break;
			}
			if(config.weightColourByAlpha){
				flag |= dxt.weightColourByAlpha;
			}

			let compressed = dxt.compress(Buffer.from(data),img.width,img.height,flag)
			let finalBuffer = Buffer.concat([headerBuffer,compressed])
			infos.innerHTML+='---------------<br/>compression completed<br/>duration :<strong>'+(Date.now()-start)+"</strong>ms<br/>"
			let fd =  fs.openSync(__dirname+"/tmp/test2.dds", 'w')
			fs.write(fd, finalBuffer, 0, finalBuffer.length, 0, function(err,written){
				infos.innerHTML+='size: <strong>'+finalBuffer.length+"</strong>bytes<br/>"
				loadTexture(__dirname+"/tmp/test2.dds")
			})
		}
		img.src = e.target.result
	}
	reader.readAsDataURL(file)
}

function getRGB(data){
	const l = data.length/4
	let rgb = new Uint8Array(l*3)
	for(let i=0;i<l;i++){
		rgb[i*3]=data[i*4]
		rgb[i*3+1]=data[i*4+1]
		rgb[i*3+2]=data[i*4+2]
	}
	return rgb
}

function calculatePitch( width, bitsPerPixel ){
	return ( width * bitsPerPixel + 7 ) / 8
}
function int32ToFourCC( value ) {

	return String.fromCharCode(
		value & 0xff,
		( value >> 8 ) & 0xff,
		( value >> 16 ) & 0xff,
		( value >> 24 ) & 0xff
	);

}

let camera
let scene
let renderer
let mesh
let loader = new THREE.DDSLoader()

function initWebgl(){
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 2000 )
	camera.position.z = 500
	camera.lookAt(new THREE.Vector3())
	scene = new THREE.Scene()
	renderer = new THREE.WebGLRenderer( { antialias: true } )
	renderer.setPixelRatio( window.devicePixelRatio )
	renderer.setSize( window.innerWidth, window.innerHeight )
	document.body.appendChild( renderer.domElement )
	let geometry = new THREE.BoxGeometry( 200, 200, 200 )
	let material = new THREE.MeshBasicMaterial( { color:Math.random()*0xFFFFFF, transparent: true } )
	mesh = new THREE.Mesh( geometry,material )
	scene.add( mesh )
}

function animate() {
	requestAnimationFrame( animate )
	var time = Date.now() * 0.001
	mesh.rotation.x = time
	mesh.rotation.y = time
	renderer.render( scene, camera )
}

initWebgl()
animate()

function loadTexture(url){
	const start = Date.now()
	url = url || __dirname+"/tmp/disturb_dxt1_mip.dds"
	let map = loader.load( url )
	map.minFilter = map.magFilter = THREE.LinearFilter
	map.anisotropy = 4
	mesh.material = new THREE.MeshBasicMaterial( { map:map, transparent: true, side:THREE.DoubleSide } )
	// infos.innerHTML+='---------------------------<br/>loaded in: <strong>'+(Date.now()-start)+"</strong>ms"
}

document.addEventListener('dragover', function (e) {
  e.preventDefault()
  return false
}, false)

document.addEventListener('drop', function (e) {
  e.preventDefault()
  let files = e.target.files || e.dataTransfer.files
  for (let i = 0, f; f = files[i]; i++) {
	  ParseFile(f)
  }
  return false
}, false)