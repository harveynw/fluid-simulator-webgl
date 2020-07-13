#version 300 es

precision highp float;

uniform sampler2D u_velocity;
uniform sampler2D u_particle_position;
uniform sampler2D u_particle_velocity;

uniform ivec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform int u_gridTextureSize;
uniform float u_dt;

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
	// RK2 Midpoint method
	int particle_index = int(round(v_particle_index));

	vec3 position = texelFetch(u_particle_position, ivec2(particle_index, 0), 0).xyz;
	vec3 velocity = texelFetch(u_particle_velocity, ivec2(particle_index, 0), 0).xyz;

	vec3 velocityMidPoint = interpolateVelocity(position + 0.5*velocity*u_dt);

	vec3 newPosition = position + u_dt*velocityMidPoint;

	float small = 0.0001;
	vec3 boundLower = vec3(small, small, small);
	vec3 boundUpper = vec3(1.0-small, 1.0-small, 1.0-small);

	outColor = vec4(clamp(newPosition, boundLower, boundUpper), 1);
}