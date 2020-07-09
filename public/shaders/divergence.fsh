#version 300 es

precision highp float;

uniform sampler2D u_velocity;
uniform vec3 u_gridStepSize;
uniform ivec3 u_gridSize;
uniform int u_textureSize;
uniform int u_gridTextureSize;

in vec2 v_texture_coord;

out vec4 outColor;

vec3 getVelocityAtCell(ivec3 indices) {
	// If requested outside grid
	if(any(greaterThanEqual(indices,u_gridSize)) || any(lessThan(indices,ivec3(0,0,0)))) {
		return(vec3(0,0,0));
	}

	ivec3 macGridSize = u_gridSize + 1;

	// Index in the splatted 2D texture
	int index = indices.z * (macGridSize.x * macGridSize.y) + indices.y * (macGridSize.x) + indices.x;

	int divisor = int(floor(float(index)/float(u_gridTextureSize)));
	int modulo = index - u_gridTextureSize*divisor;

	return(texelFetch(u_velocity, ivec2(modulo, divisor), 0).xyz);
}

ivec3 extractCellCoordinate(vec2 textureCoord) {
	int textureX = int(round(textureCoord.x * float(u_textureSize)));
	int textureY = int(round(textureCoord.y * float(u_textureSize)));

	int index = textureX + u_textureSize*textureY;

	// Formula to unpack:
	// index = indices.z * (u_gridSize.x * u_gridSize.y) + indices.y * (u_gridSize.x) + indices.x;

	int z = int(floor(float(index)/float(u_gridSize.x * u_gridSize.y)));
	int y = int(floor(float(index-(z * u_gridSize.x * u_gridSize.y))/float(u_gridSize.x)));
	int x = index - (z * u_gridSize.x * u_gridSize.y) - (y * u_gridSize.x);

	return(ivec3(x, y, z));
}
 
void main() {
	ivec3 cellCoordinate = extractCellCoordinate(v_texture_coord);

	vec3 velocityIn = getVelocityAtCell(cellCoordinate);

	float xOut = getVelocityAtCell(cellCoordinate + ivec3(1,0,0)).x;
	float yOut = getVelocityAtCell(cellCoordinate + ivec3(0,1,0)).y;
	float zOut = getVelocityAtCell(cellCoordinate + ivec3(0,0,1)).z;
	vec3 velocityOut = vec3(xOut, yOut, zOut);

	// TODO render to a texture with just one channel as that's all we need
	outColor = vec4(dot(velocityOut - velocityIn, vec3(1,1,1)/u_gridStepSize), 0, 0, 1);
}