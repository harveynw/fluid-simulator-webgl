/*
// Where to map onto label texture
export function data_particleTextureCoordinates(sim) {
  let data = [];

  for(let x = 0; x < sim.GRID_X_SIZE; x++) {
    for(let y = 0; y < sim.GRID_Y_SIZE; y++) {
      for(let z = 0; z < sim.GRID_Z_SIZE; z++) {
        let index = z * (sim.GRID_X_SIZE * sim.GRID_Y_SIZE) + y * (sim.GRID_X_SIZE) + x;

        // X and Y index on texture
        data.push(index % textureize);
        data.push(Math.floor(index/textureSize));
      }
    }S
  }

  return(new Float32Array(data));
}

// Position of the bottom corner of the current grid cell
export function data_particleGridCoordinates(sim) {
  let data = [];

  for(let x = 0; x < sim.GRID_X_SIZE; x++) {
    for(let y = 0; y < sim.GRID_Y_SIZE; y++) {
      for(let z = 0; z < sim.GRID_Z_SIZE; z++) {
        let index = z * (sim.GRID_X_SIZE * sim.GRID_Y_SIZE) + y * (sim.GRID_X_SIZE) + x;

        // X,Y,Z 'position' starting from 1 up to GRID_SIZE
        positionCoords.push(x/sim.GRID_X_SIZE);
        positionCoords.push(y/sim.GRID_Y_SIZE);
        positionCoords.push(z/sim.GRID_Z_SIZE);
      }
    }
  }

  return(new Float32Array(data));
}
*/

export function data_particleIndices(sim) {
    return(new Int32Array([...Array(sim.NUM_PARTICLES).keys()]));
}

