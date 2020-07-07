#version 300 es
precision highp float;
 
// our texture
uniform sampler2D u_velocity_part;
uniform sampler2D u_divisor_part;
 
// the texCoords passed in from the vertex shader.
in vec2 v_texture_coord;
 
// we need to declare an output for the fragment shader
out vec4 outColor;

bool isZero(float n) {
	float epsilon = 0.0001;
	return(abs(n) <	epsilon);
}
 
void main() {
	// Look up a color from the texture.
    vec3 vel = texture(u_velocity_part, v_texture_coord).xyz;
    vec3 div = texture(u_divisor_part, v_texture_coord).xyz;

    // If no particles make a weighted contribution, stop divide by zero
    for(int i = 0; i < 3; i++) {
    	if(isZero(div[i])) {
   			vel[i] = 0.0;
   			div[i] = 1.0;
   		}
    }

   	outColor = vec4(vel/div, 1.0);
}