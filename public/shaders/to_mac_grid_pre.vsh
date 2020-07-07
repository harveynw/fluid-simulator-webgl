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

vec2 componentsToTexture(ivec3 cellIndices) {
	/*
	// Convert [0,1] position to grid cell number [0,cell count]
	vec3 scaled = cellPosition * vec3(u_gridSize);
	ivec3 indices = ivec3(floor(scaled.x),floor(scaled.y),floor(scaled.z));
	*/
	ivec3 macGridSize = u_gridSize + 1;
	ivec3 indices = cellIndices;

	// Index in the splatted 2D texture
	int index = indices.z * (macGridSize.x * macGridSize.y) + indices.y * (macGridSize.x) + indices.x;

	int divisor = int(floor(float(index)/float(u_textureSize)));
	int modulo = index - u_textureSize*divisor;
	vec2 textureCoordinate = vec2(modulo, divisor)/float(u_textureSize);

	return(textureCoordinate*2.0 - 1.0);
}
 
void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;
	vec3 velocity = texelFetch(u_particle_velocity, ivec2(a_particle_index, 0), 0).xyz;

	float cellX = floor(position.x/u_gridStepSize.x);
	float cellY = floor(position.y/u_gridStepSize.y);
	float cellZ = floor(position.z/u_gridStepSize.z);

	vec3 particleCell = vec3(cellX, cellY, cellZ);
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

  	gl_Position = vec4(componentsToTexture(ivec3(gridCell)), 0, 1);
  	gl_PointSize = 1.0;
}
