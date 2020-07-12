#version 300 es

precision highp float;

uniform sampler2D u_pressure;
uniform sampler2D u_label;
uniform sampler2D u_divergence;

uniform ivec3 u_gridSize;
uniform int u_textureSize;
uniform int u_gridTextureSize;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;

float getDivergenceAtCell(ivec3 indices) {
	// If requested outside grid
	if(any(greaterThanEqual(indices,u_gridSize)) || any(lessThan(indices,ivec3(0,0,0)))) {
		return(0.0);
	}

	float divergence = texelFetch(u_divergence, indicesToTexels(indices, u_gridSize, u_textureSize), 0).x;	

	return(divergence);
}

float getPressureAtCell(ivec3 indices) {
	// If requested outside grid
	if(any(greaterThanEqual(indices,u_gridSize)) || any(lessThan(indices,ivec3(0,0,0)))) {
		return(0.0);
	}

	float pressure = texelFetch(u_pressure, indicesToTexels(indices, u_gridSize, u_textureSize), 0).x;

	return(pressure);
}
 
void main() {
	if(texture(u_label, v_texture_coord).xyz == vec3(0,0,0)) discard;

	ivec3 cellIndices = textureCoordsToIndices(v_texture_coord, u_gridSize, u_textureSize);

	float divergence = getDivergenceAtCell(cellIndices);

	float x1 = getPressureAtCell(cellIndices + ivec3(-1,0,0));
	float x2 = getPressureAtCell(cellIndices + ivec3(1,0,0));
	float y1 = getPressureAtCell(cellIndices + ivec3(0,-1,0));
	float y2 = getPressureAtCell(cellIndices + ivec3(0,1,0));
	float z1 = getPressureAtCell(cellIndices + ivec3(0,0,-1));
	float z2 = getPressureAtCell(cellIndices + ivec3(0,0,1));

	// TODO Does the divisor of 6 change depending on circumstance? in notes
	float pressureUpdate = (x1 + x2 + y1 + y2 + z1 + z2 - divergence)/6.0;

	outColor = vec4(pressureUpdate,0,0,1);
}