#version 300 es

precision highp float;

uniform sampler2D u_velocity_boundary;
uniform sampler2D u_pressure;

uniform vec3 u_gridSize;
uniform float u_textureSize;
uniform float u_gridTextureSize;
uniform vec3 u_gridStepSize;
uniform float u_dt;

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
	vec3 velocity = texture(u_velocity_boundary, v_texture_coord).rgb;
	vec3 position = textureToPositionPadded(v_texture_coord, u_gridSize, u_gridTextureSize);

	float pressureInCell = getPressureAtCell(position);

	float pressureGradX = pressureInCell - getPressureAtCell(position+u_gridStepSize*vec3(-1,0,0));
	float pressureGradY = pressureInCell - getPressureAtCell(position+u_gridStepSize*vec3(0,-1,0));
	float pressureGradZ = pressureInCell - getPressureAtCell(position+u_gridStepSize*vec3(0,0,-1));

	vec3 pressureGradient = vec3(pressureGradX, pressureGradY, pressureGradZ);

	vec3 newVelocity = velocity - pressureGradient/u_gridStepSize;

	outColor = vec4(newVelocity,1);
}