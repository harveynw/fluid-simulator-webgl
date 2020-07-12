#version 300 es
 
in int a_particle_index;
in vec3 a_displacement;

uniform sampler2D u_particle_position;
uniform sampler2D u_particle_velocity;

uniform ivec3 u_gridSize;
uniform vec3 u_gridStepSize;
uniform int u_textureSize;

out vec3 v_velocity;
out vec3 v_weight;

@import-util;

void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;
	vec3 velocity = texelFetch(u_particle_velocity, ivec2(a_particle_index, 0), 0).xyz;

	vec3 particleCell = vec3(positionToIndices(position, u_gridSize));
	vec3 gridCell = particleCell + a_displacement;
	vec3 gridCellPosition = gridCell/vec3(u_gridSize);

	// Any displacements outside grid can be ignored
	if(any(lessThan(gridCellPosition, vec3(0,0,0))) || any(greaterThan(gridCellPosition, vec3(1,1,1)))) {
		gl_Position = vec4(1000, 1000, 1000, 1);
		return;
	}

	float weightX = (abs(position.x - gridCellPosition.x) - 3.0) * -1.0;
	float weightY = (abs(position.y - gridCellPosition.y) - 3.0) * -1.0;
	float weightZ = (abs(position.z - gridCellPosition.z) - 3.0) * -1.0;

	v_weight = vec3(weightX, weightY, weightZ);
	v_velocity = velocity*v_weight;

  	gl_Position = vec4(indicesToClipSpace(ivec3(gridCell), u_gridSize+1, u_textureSize), 0, 1);
  	gl_PointSize = 1.0;
}
