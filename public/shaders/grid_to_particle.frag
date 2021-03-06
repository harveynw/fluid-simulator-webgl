#version 300 es

precision highp float;

uniform sampler2D u_velocity_updated;
uniform sampler2D u_particle_position;

uniform vec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform float u_gridTextureSize;

in float v_particle_index;

out vec4 outColor;

@import-util;

vec3 fetchVelocity(vec3 position) {
	vec2 textureCoords = positionToTexturePadded(position, u_gridSize, u_gridTextureSize);
	return(texture(u_velocity_updated, textureCoords).xyz);
}

vec3 interpolateVelocity(vec3 position) {
	vec3 velocityCentre = fetchVelocity(position);
	float velX = fetchVelocity(position + u_gridStepSize * vec3(1,0,0)).x;
	float velY = fetchVelocity(position + u_gridStepSize * vec3(0,1,0)).y;
	float velZ = fetchVelocity(position + u_gridStepSize * vec3(0,0,1)).z;
	
	vec3 alpha = (position/u_gridStepSize) - floor(position/u_gridStepSize);

	return((1.0-alpha)*velocityCentre + alpha*vec3(velX, velY, velZ));
}

void main() {
	int particle_index = int(round(v_particle_index));

	vec3 position = texelFetch(u_particle_position, ivec2(particle_index, 0), 0).xyz;

	vec3 interpolated = interpolateVelocity(position);

	outColor = vec4(interpolated,1);
}