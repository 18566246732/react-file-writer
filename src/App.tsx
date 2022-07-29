import React from 'react';
import './App.css';
import { Switch, Route, Link } from 'react-router-dom';
import FilePicker from './FilePicker';

function App() {
  return (
    <div className="App">
      <div style={{display: 'flex', justifyContent: 'space-around', height: '30px'}}>
        <Link to="/">home</Link>
        <Link to="/phone">phone</Link>
        <Link to="/chat">chat</Link>
      </div>
      <div style={{height: '800px', backgroundColor: 'blue', color: 'white', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Switch>
          <Route exact path="/">
            <FilePicker />
          </Route>
          <Route path="/phone">
            phone content
          </Route>
          <Route path="/chat">
            chat content 
          </Route>
        </Switch>
      </div>
    </div>
  );
}

export default App;
