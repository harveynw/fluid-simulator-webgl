#version 300 es
 
layout(location = 0) in int a_particle_index;
layout(location = 1) in vec3 a_displacement;

uniform sampler2D u_particle_position;
uniform sampler2D u_particle_velocity;

uniform vec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform float u_gridTextureSize;

out vec3 v_velocity;
out vec3 v_weight;

@import-util;

void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;
	vec3 velocity = texelFetch(u_particle_velocity, ivec2(a_particle_index, 0), 0).xyz;

	vec3 displacedCellPosition = (floor(position/u_gridStepSize) + a_displacement)*u_gridStepSize;

	// Any displacements outside grid can be ignored
	if(any(greaterThanEqual(displacedCellPosition,vec3(1,1,1))) || any(lessThan(displacedCellPosition,vec3(0,0,0)))) {
		gl_Position = vec4(1000, 1000, 1000, 1);
		return;
	}

	float weightX = (abs(position.x - displacedCellPosition.x) - 3.0) * -1.0;
	float weightY = (abs(position.y - displacedCellPosition.y) - 3.0) * -1.0;
	float weightZ = (abs(position.z - displacedCellPosition.z) - 3.0) * -1.0;

	v_weight = (abs(position - displacedCellPosition)/u_gridStepSize - 3.0) * -1.0;
	v_velocity = velocity*v_weight;

	vec2 textureCoords = positionToTexturePadded(displacedCellPosition, u_gridSize, u_gridTextureSize);
  	gl_Position = vec4(textureCoords, 0, 1);
  	gl_PointSize = 1.0;
}
