#version 300 es

precision highp float;

layout(location = $VELOCITY_TEXTURE) uniform sampler2D u_velocity;
layout(location = $PARTICLE_POSITION) uniform sampler2D u_particle_position;
layout(location = $PARTICLE_VELOCITY) uniform sampler2D u_particle_velocity;

layout(location = $GRID_SIZE) uniform vec3 u_gridSize;
layout(location = $GRID_STEP_SIZE) uniform vec3 u_gridStepSize;
layout(location = $GRID_TEXTURE_SIZE) uniform float u_gridTextureSize;
layout(location = $DT) uniform float u_dt;

in float v_particle_index;

out vec4 outColor;

@import-util;

vec3 fetchVelocity(vec3 position) {
	vec2 textureCoords = positionToTexturePadded(position, u_gridSize, u_gridTextureSize);
	return(texture(u_velocity, textureCoords).xyz);
}

vec3 interpolateVelocity(vec3 position) {
	vec3 positionScaled = position / u_gridStepSize;

	vec3 velocityCentre = fetchVelocity(position);
	float velX = fetchVelocity(position + u_gridStepSize*vec3(1,0,0)).x;
	float velY = fetchVelocity(position + u_gridStepSize*vec3(0,1,0)).y;
	float velZ = fetchVelocity(position + u_gridStepSize*vec3(0,0,1)).z;

	vec3 alpha = positionScaled - floor(positionScaled);

	return((1.0-alpha)*velocityCentre + alpha*vec3(velX, velY, velZ));
}

void main() {
	// RK2 Midpoint method
	int particle_index = int(round(v_particle_index));

	vec3 position = texelFetch(u_particle_position, ivec2(particle_index, 0), 0).xyz;
	vec3 velocity = texelFetch(u_particle_velocity, ivec2(particle_index, 0), 0).xyz;

	vec3 velocityMidPoint = interpolateVelocity(position + 0.5*velocity*u_dt);

	//vec3 newPosition = position + u_dt*velocityMidPoint;
	vec3 newPosition = position + u_dt*velocity;

	float small = 0.0001;
	vec3 boundLower = vec3(small, small, small);
	vec3 boundUpper = vec3(1.0-small, 1.0-small, 1.0-small);

	outColor = vec4(clamp(newPosition, boundLower, boundUpper), 1);
	//outColor = vec4(velocity*u_dt, 1);
}