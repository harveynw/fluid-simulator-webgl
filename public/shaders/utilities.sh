ivec2 indicesToTexels(ivec3 indices, ivec3 indicesLimit, int targetTextureSize) {
	// Index in the splatted 2D texture
	int index = indices.z * (indicesLimit.x * indicesLimit.y) + indices.y * (indicesLimit.x) + indices.x;

	int divisor = int(floor(float(index)/float(targetTextureSize)));
	int modulo = index - targetTextureSize*divisor;

	return(ivec2(modulo, divisor));
}

vec2 indicesToClipSpace(ivec3 indices, ivec3 indicesLimit, int targetTextureSize) {
	ivec2 texels = indicesToTexels(indices, indicesLimit, targetTextureSize);

	vec2 textureCoordinate = vec2(texels)/float(targetTextureSize);
	return(textureCoordinate*2.0 - 1.0);
}

ivec3 textureCoordsToIndices(vec2 textureCoord, ivec3 indicesLimit, int textureSize) {
	int textureX = int(round(textureCoord.x * float(textureSize)));
	int textureY = int(round(textureCoord.y * float(textureSize)));

	int index = textureX + textureSize*textureY;

	// Formula to unpack:
	// index = indices.z * (indicesLimit.x * indicesLimit.y) + indices.y * (indicesLimit.x) + indices.x;
	int z = int(floor(float(index)/float(indicesLimit.x * indicesLimit.y)));
	int y = int(floor(float(index-(z * indicesLimit.x * indicesLimit.y))/float(indicesLimit.x)));
	int x = index - (z * indicesLimit.x * indicesLimit.y) - (y * indicesLimit.x);

	return(ivec3(x, y, z));
}

ivec3 positionToIndices(vec3 position, ivec3 gridSize) {
	vec3 scaled = position * vec3(gridSize);
	return(ivec3(floor(scaled.x),floor(scaled.y),floor(scaled.z)));
}