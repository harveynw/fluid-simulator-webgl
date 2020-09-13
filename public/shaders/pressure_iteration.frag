#version 300 es

precision highp float;

uniform sampler2D u_pressure;
uniform sampler2D u_label;
uniform sampler2D u_divergence;

uniform vec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform float u_textureSize;
uniform float u_gridTextureSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;

float getPressureAtCell(vec3 position) {
	// If requested outside grid
	if(any(greaterThanEqual(position,vec3(1,1,1))) || any(lessThan(position,vec3(0,0,0)))) {
		return(0.0);
	}

	vec2 textureCoords = positionToTexture(position, u_gridSize, u_textureSize);

	float pressure = texture(u_pressure, textureCoords).x;

	return(pressure);
}
 
void main() {
	if(texture(u_label, v_texture_coord).xyz == vec3(0,0,0)) discard;

	vec3 cellPosition = textureToPosition(v_texture_coord, u_gridSize, u_textureSize);

	float divergence = texture(u_divergence, v_texture_coord).x;
	float x1 = getPressureAtCell(cellPosition + u_gridStepSize*vec3(-1,0,0));
	float x2 = getPressureAtCell(cellPosition + u_gridStepSize*vec3(1,0,0));
	float y1 = getPressureAtCell(cellPosition + u_gridStepSize*vec3(0,-1,0));
	float y2 = getPressureAtCell(cellPosition + u_gridStepSize*vec3(0,1,0));
	float z1 = getPressureAtCell(cellPosition + u_gridStepSize*vec3(0,0,-1));
	float z2 = getPressureAtCell(cellPosition + u_gridStepSize*vec3(0,0,1));

	// TODO Does the divisor of 6 change depending on circumstance? in notes
	float pressureUpdate = (x1 + x2 + y1 + y2 + z1 + z2 - divergence)/6.0;

	outColor = vec4(pressureUpdate,0,0,1);
}