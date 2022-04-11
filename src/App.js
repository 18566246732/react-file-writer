import './App.css';
import { Switch, Route, Link } from 'react-router-dom';

function App() {
  return (
    <div className="App">
      <div style={{display: 'flex', justifyContent: 'space-around', height: '30px'}}>
        <Link to="/">home</Link>
        <Link to="/phone">phone</Link>
        <Link to="/chat">chat</Link>
      </div>
      <div style={{height: '600px', backgroundColor: 'blue', color: 'white', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Switch>
          <Route exact path="/">
            home content
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
