#version 300 es

precision highp float;

uniform sampler2D u_velocity;
uniform sampler2D u_pressure;

uniform ivec3 u_gridSize;
uniform int u_textureSize;
uniform int u_gridTextureSize;
uniform vec3 u_gridStepSize;
uniform float u_dt;

in vec2 v_texture_coord;

out vec4 outColor;

@import-util;

float getPressureAtCell(ivec3 indices) {
	// If requested outside grid
	if(any(greaterThanEqual(indices,u_gridSize)) || any(lessThan(indices,ivec3(0,0,0)))) {
		return(0.0);
	}

	float pressure = texelFetch(u_pressure, indicesToTexels(indices, u_gridSize, u_textureSize), 0).x;

	return(pressure);
}
 
void main() {
	vec3 velocity = texture(u_velocity, v_texture_coord).rgb;
	ivec3 indices = textureCoordsToIndices(v_texture_coord, u_gridSize+1, u_gridTextureSize);

	float pressureInCell = getPressureAtCell(indices);

	float pressureGradX = pressureInCell - getPressureAtCell(indices+ivec3(-1,0,0));
	float pressureGradY = pressureInCell - getPressureAtCell(indices+ivec3(0,-1,0));
	float pressureGradZ = pressureInCell - getPressureAtCell(indices+ivec3(0,0,-1));

	vec3 pressureGradient = vec3(pressureGradX, pressureGradY, pressureGradZ);

	vec3 newVelocity = velocity - u_dt*(pressureGradient/u_gridStepSize);

	outColor = vec4(newVelocity,1);
}