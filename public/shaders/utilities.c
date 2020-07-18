ivec2 indicesToTexels(ivec3 indices, ivec3 indicesLimit, int targetTextureSize) {
	// Index in the splatted 2D texture
	int index = indices.z * (indicesLimit.x * indicesLimit.y) + indices.y * (indicesLimit.x) + indices.x;

	int divisor = int(floor(float(index)/float(targetTextureSize)));
	int modulo = index - targetTextureSize*divisor;

	return(ivec2(modulo, divisor));
}

/*
	Maps a 3D system position to its corresponding cell splatted to a texture
	Note: This function relies on the assumption that GL_NEAREST blending is enabled
*/
vec2 positionToTexture(vec3 position, vec3 cellCount, float targetTextureSize) {
	vec3 cell = floor(position * cellCount);

	float index = cell.z * (cellCount.x * cellCount.y) + cell.y * (cellCount.x) + cell.x;
	index += 0.5;

	float modulo = fract(index/targetTextureSize);
	float divisor = floor(index/targetTextureSize);

	return(vec2(modulo, (divisor+0.5)/targetTextureSize));
}

/*
	Use this function when working with the MAC grid, in which an additional cell
	must be appended on each axis
*/
vec2 positionToTexturePadded(vec3 position, vec3 cellCount, float targetTextureSize) {
	// Scaling position vector
	vec3 correctedPosition = position * (cellCount/(cellCount+1.0));
	return(positionToTexture(correctedPosition, cellCount+1.0, targetTextureSize));
}

/*
	Undoes the splatting achieved through positionToTexture
*/
vec3 textureToPosition(vec2 textureCoord, vec3 cellCount, float textureSize) {
	float divisor = textureCoord.y*textureSize-0.5;
	float index = (textureCoord.x + divisor) * textureSize - 0.5;

	float zCoeff = cellCount.x * cellCount.y
	float z = floor(index/zCoeff);
	float y = floor((index - z * zCoeff)/cellCount.x);
	float x = index - z * zCoeff - y * cellCount.x;

	return vec3(x, y, z)/cellCount;
}
vec3 textureToPositionPadded(vec2 textureCoord, vec3 cellCount, float textureSize) {
	vec3 position = textureToPosition(textureCoord, cellCount+1, textureSize);
	return(position * ((cellCount+1.0)/cellCount));
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