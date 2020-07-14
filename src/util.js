/** WebGL Helper Functions **/

export function checkFramebuffer(gl, checkID) {
	alert("Check " + checkID + ": " + gl.checkFramebufferStatus(gl.FRAMEBUFFER) + " / " + gl.FRAMEBUFFER_COMPLETE);
}

export function bufferDataAttribute(gl, program, attributeName, data, componentSize, type, divisor = 0) {
	let attributeLocation = gl.getAttribLocation(program, attributeName);
	//console.log("Attribute location found for " + attributeName+":");
  	//console.log(attributeLocation);
	let buffer = gl.createBuffer();

	gl.enableVertexAttribArray(attributeLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); // ? Optimise STATIC_DRAW

	let normalize = false; // don't normalize the data
	let stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
	let offset = 0;  

	if(type === gl.INT) {
		gl.vertexAttribIPointer(
			attributeLocation, componentSize, type, stride, offset);
	} else {
  		gl.vertexAttribPointer(
			attributeLocation, componentSize, type, normalize, stride, offset);
	} 

	// For instanced drawing
	if(divisor !== 0) {
		gl.vertexAttribDivisor(attributeLocation, divisor);
	}
}

export function framebufferTexture2D(gl, attachment, texture) {
	gl.framebufferTexture2D(
	gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function texImage2D(gl, texture, width, height, data) {
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0,
		gl.RGBA, gl.FLOAT, data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function initOpenGl(canvas) {
	let gl = canvas.getContext("webgl2");
	if(!gl) {
		alert('WebGL2 not available');
	}

	return gl;
}

export function resizeToDisplay(canvas) {
	// Lookup the size the browser is displaying the canvas.
	let displayWidth  = canvas.clientWidth;
	let displayHeight = canvas.clientHeight;

	// Check if the canvas is not the same size.
	if (canvas.width  !== displayWidth ||
		canvas.height !== displayHeight) {
 
		// Make the canvas the same size
		canvas.width  = displayWidth;
		canvas.height = displayHeight;
	}
}

export async function getPrograms(gl, ...programNames) {
	let programs = {};
	let sources = await getShaderSources(programNames);
	Object.keys(sources).forEach(name => {
		let src = sources[name];
		let vertexShaderSource = src[0];
		let fragmentShaderSource = src[1];

		console.log("Creating program: " + name);

		programs[name] = createProgram(gl, vertexShaderSource, fragmentShaderSource);
	});

	console.log(programs);
	return programs;
}

function createShader(gl, type, source) {
	let shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (success) {
		return shader;
	}

	console.log(gl.getShaderInfoLog(shader));
	gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
	let program = gl.createProgram();
	gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShader));
	gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShader));
	gl.linkProgram(program);
	let success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (success) {
		return program;
	}
 
	console.log(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
}

async function getShaderSources(shaderNames) {
	const util = await fetch('/shaders/utilities.sh').then(body => body.text());

	let shaderSources = {};
	let promises = shaderNames.map(shader => {
		let vertexShaderPromise = fetch('/shaders/' + shader + '.vsh').then(body => {
			return body.text().then(text => text.replace("@import-util;", util));
		});
		let fragmentShaderPromise = fetch('/shaders/' + shader + '.fsh').then(body => {
			return body.text().then(text => text.replace("@import-util;", util));
		});
		return Promise.all([vertexShaderPromise, fragmentShaderPromise]);
	});

	const sources = await Promise.all(promises);
	console.log("Sources:");
	//console.log(sources);
	sources.forEach((fetched, index) => {
		shaderSources[shaderNames[index]] = fetched;
	});
	console.log(shaderSources);
	return shaderSources;
}