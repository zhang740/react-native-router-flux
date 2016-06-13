/**
 * Copyright (c) 2015-present, Pavel Aksonov
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import React, {
  Component,
  PropTypes,
} from 'react';
import NavigationExperimental from 'react-native-experimental-navigation';

import Actions, {POP_ACTION} from './Actions';
import getInitialState from './State';
import Reducer from './Reducer';
import DefaultRenderer from './DefaultRenderer';
import Scene from './Scene';

const {
  CardStack,
} = NavigationExperimental;

const propTypes = {
  dispatch: PropTypes.func,
};

class Router extends Component {

  constructor(props) {
    super(props);
    this.state = {};
    this.routerReducer = null;
    this.handleProps = this.handleProps.bind(this);
    this.onPopRoute = this.onPopRoute.bind(this);
  }

  componentDidMount() {
    this.handleProps(this.props);
  }

  componentWillReceiveProps(props) {
    this.handleProps(props);
  }

  handleProps(props) {
    let scenesMap;

    if (props.scenes) {
      scenesMap = props.scenes;
    } else {
      let scenes = props.children;

      if (Array.isArray(props.children) || props.children.props.component) {
        scenes = (
          <Scene
            key="__root"
            hideNav
            {...this.props}
          >
            {props.children}
          </Scene>
        );
      }
      scenesMap = Actions.create(scenes, props.wrapBy);
    }

    // eslint-disable-next-line no-unused-vars
    const { children, styles, scenes, reducer, createReducer, ...parentProps } = props;

    scenesMap.rootProps = parentProps;

    const navigationState = props.navigationState || getInitialState(scenesMap);

    if (!props.navigationState) {
      const reducerCreator = createReducer || Reducer;
      this.routerReducer = reducer || (
          reducerCreator({
            initialState: navigationState,
            scenes: scenesMap,
          }));
    }

    this.setState({ navigationState });

    Actions.callback = action => {
      if (this.props.dispatch) this.props.dispatch(action);
      const newState = this.routerReducer(this.state.navigationState, action);
      if (newState !== this.state.navigationState) {
        this.setState({ navigationState: newState });
        return true;
      }
      return false;
    };
  }

  onPopRoute() {
    Actions.callback({ type: POP_ACTION });
  }

  render() {
    console.log("NEW STATE", this.state.navigationState);
    if (!this.state.navigationState) return null;

    return (
      <DefaultRenderer
        onNavigate={this.onPopRoute}
        navigationState={this.state.navigationState}
        style={this.props.style}
      />
    );
  }
}

Router.propTypes = propTypes;

export default Router;
