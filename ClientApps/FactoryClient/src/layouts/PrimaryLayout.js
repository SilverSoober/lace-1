import React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'
import PrimaryHeader from '../ui/PrimaryHeader'
import AppHomePage from '../pages/AppHomePage'

// Sub Layouts
import AssetsSubLayout from './AssetsSubLayout'
import ProductSubLayout from './ProductSubLayout'

const PrimaryLayout = ({ match }) => (
  <div className="primary-layout">
    <PrimaryHeader />
    <main>
      <Switch>
        <Route path={`${match.path}`} exact component={AppHomePage} />
        <Route path={`${match.path}/Assets`} component={AssetsSubLayout} />
        
        <Redirect to={`${match.url}`} />
      </Switch>
    </main>
  </div>
)

//<Route path={`${match.path}/products`} component={ProductSubLayout} />

export default PrimaryLayout