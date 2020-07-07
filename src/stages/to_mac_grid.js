export function data_particleIndices(sim) {
  	return(new Int32Array([...Array(sim.NUM_PARTICLES).keys()]));
}

export function data_displacement(sim) {
	let data = [];

	for(let i = -2; i <= 2; i++) {
		for(let j = -2; j <= 2 ; j++) {
			for(let k = -2; k <= 2; k++) {
				data.push(i);
				data.push(j);
				data.push(k);
			}
		}
	}

	return(new Float32Array(data));
}