#version 300 es
 
in int a_particle_index;

uniform sampler2D u_particle_position;
uniform sampler2D u_particle_velocity;

uniform ivec3 u_gridSize;
uniform int u_textureSize;

vec2 positionToTexture(vec3 position) {
	// Convert [0,1] position to grid cell number [0,cell count)
	vec3 scaled = position * vec3(u_gridSize);
	ivec3 indices = ivec3(floor(scaled.x),floor(scaled.y),floor(scaled.z));

	// Index in the splatted 2D texture
	int index = indices.z * (u_gridSize.x * u_gridSize.y) + indices.y * (u_gridSize.x) + indices.x;

	int divisor = int(floor(float(index)/float(u_textureSize)));
	int modulo = index - u_textureSize*divisor;
	vec2 textureCoordinate = vec2(modulo, divisor)/float(u_textureSize);

	return(textureCoordinate*2.0 - 1.0);
}

void main() {
	vec3 position = texelFetch(u_particle_position, ivec2(a_particle_index, 0), 0).xyz;
	
	gl_Position = vec4(positionToTexture(position), 0, 1);

	gl_PointSize = 1.0;
}