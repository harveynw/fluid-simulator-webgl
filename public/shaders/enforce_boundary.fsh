#version 300 es

precision highp float;

uniform sampler2D u_texture;
uniform int u_textureSize;
uniform ivec3 u_gridSize;

in vec2 v_texture_coord;

out vec4 outColor;

// TODO workout floats vs ints performance
ivec3 extractCellCoordinate(vec2 textureCoord) {
	int textureX = int(round(textureCoord.x * float(u_textureSize)));
	int textureY = int(round(textureCoord.y * float(u_textureSize)));

	int index = textureX + u_textureSize*textureY;

	ivec3 macGridSize = u_gridSize + 1;

	// Formula to unpack:
	// index = indices.z * (macGridSize.x * macGridSize.y) + indices.y * (macGridSize.x) + indices.x;

	int z = int(floor(float(index)/float(macGridSize.x * macGridSize.y)));
	int y = int(floor(float(index-(z * macGridSize.x * macGridSize.y))/float(macGridSize.x)));
	int x = index - (z * macGridSize.x * macGridSize.y) - (y * macGridSize.x);

	return(ivec3(x, y, z));
}
 
void main() {
	vec3 velocity = texture(u_texture, v_texture_coord).xyz;
	ivec3 cellCoordinate = extractCellCoordinate(v_texture_coord);

	// Correct velocity if boundary cell
	if(cellCoordinate.x == 0 || cellCoordinate.x == u_gridSize.x) {
		velocity = vec3(0, velocity.y, velocity.z);
	}
	if(cellCoordinate.y == 0 || cellCoordinate.y == u_gridSize.y) {
		velocity = vec3(velocity.x, 0, velocity.z);
	}
	if(cellCoordinate.z == 0 || cellCoordinate.z == u_gridSize.z) {
		velocity = vec3(velocity.x, velocity.y, 0);
	}

	outColor = vec4(velocity,1);
}