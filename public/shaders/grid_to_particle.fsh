#version 300 es

precision highp float;

uniform sampler2D u_velocity;
uniform sampler2D u_particle_position;

uniform ivec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform int u_gridTextureSize;

in float v_particle_index;

out vec4 outColor;

@import-util;

vec3 fetchVelocity(ivec3 indices) {
	ivec2 texels = indicesToTexels(indices, u_gridSize+1, u_gridTextureSize);
	return(texelFetch(u_velocity, texels, 0).xyz);
}

vec3 interpolateVelocity(vec3 position) {
	vec3 positionScaled = position / u_gridStepSize;
	ivec3 indices = ivec3(int(floor(positionScaled.x)), int(floor(positionScaled.y)), int(floor(positionScaled.z)));

	vec3 velocityCentre = fetchVelocity(indices);
	float velX = fetchVelocity(indices + ivec3(1,0,0)).x;
	float velY = fetchVelocity(indices + ivec3(0,1,0)).y;
	float velZ = fetchVelocity(indices + ivec3(0,0,1)).z;

	vec3 alpha = positionScaled - vec3(indices);

	return((1.0-alpha)*velocityCentre + alpha*vec3(velX, velY, velZ));
}

void main() {
	int particle_index = int(round(v_particle_index));

	vec3 position = texelFetch(u_particle_position, ivec2(particle_index, 0), 0).xyz;

	vec3 interpolated = interpolateVelocity(position);

	outColor = vec4(interpolated,1);
}