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

	float zCoeff = cellCount.x * cellCount.y;
	float z = floor(index/zCoeff);
	float y = floor((index - z * zCoeff)/cellCount.x);
	float x = index - z * zCoeff - y * cellCount.x;

	return vec3(x, y, z)/cellCount;
}

/*
	Similar to utilising positionToTexturePadded, utilise this when converting from
	a padded MAC grid texture
*/
vec3 textureToPositionPadded(vec2 textureCoord, vec3 cellCount, float textureSize) {
	vec3 position = textureToPosition(textureCoord, cellCount+1.0, textureSize);
	return(position * ((cellCount+1.0)/cellCount));
}