import React , { Component } from 'react';
import { initSimulation } from './simulation';

import './App.css';

class App extends Component {

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    const canvas = this.canvasRef.current;

    initSimulation(canvas);
  }

  render() {
    return (
      <div className="App">
        <canvas ref={this.canvasRef} />
      </div>
    );
  }
}

export default App;