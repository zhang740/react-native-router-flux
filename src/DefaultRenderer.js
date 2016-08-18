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
import {
  Animated,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';

import TabBar from './TabBar';
import NavBar from './NavBar';
import Actions from './Actions';
import { deepestExplicitValueForKey } from './Util';
import NavigationExperimental from 'react-native-experimental-navigation';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {AnimationView, AnimationModel} from 'react-native-animation'

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const {
  AnimatedView: NavigationAnimatedView,
  Card: NavigationCard,
} = NavigationExperimental;

const {
  CardStackPanResponder: NavigationCardStackPanResponder,
  CardStackStyleInterpolator: NavigationCardStackStyleInterpolator,
} = NavigationCard;

const styles = StyleSheet.create({
  animatedView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sceneStyle: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

function fadeInScene(/* NavigationSceneRendererProps */ props) {
  const {
    position,
    scene,
  } = props;

  const index = scene.index;
  const inputRange = [index - 1, index, index + 1];

  const opacity = position.interpolate({
    inputRange,
    outputRange: [0, 1, 0.3],
  });

  const scale = position.interpolate({
    inputRange,
    outputRange: [1, 1, 0.95],
  });

  const translateY = 0;
  const translateX = 0;

  return {
    opacity,
    transform: [
      { scale },
      { translateX },
      { translateY },
    ],
  };
}

function leftToRight(/* NavigationSceneRendererProps */ props) {
  const {
    position,
    scene,
  } = props;

  const index = scene.index;
  const inputRange = [index - 1, index, index + 1];

  const translateX = position.interpolate({
    inputRange,
    outputRange: [-SCREEN_WIDTH, 0, 0],
  });

  return {
    transform: [
      { translateX },
    ],
  };
}

const AnimationDatas = {}

export default class DefaultRenderer extends Component {

  static propTypes = {
    navigationState: PropTypes.object,
    onNavigate: PropTypes.func,
  };

  static childContextTypes = {
    navigationState: PropTypes.any,
  };

  constructor(props) {
    super(props);

    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
    this.renderCard = this.renderCard.bind(this);
    this.renderScene = this.renderScene.bind(this);
    this.renderHeader = this.renderHeader.bind(this);
  }

  getChildContext() {
    return {
      navigationState: this.props.navigationState,
    };
  }

  componentDidMount() {
    this.dispatchFocusAction(this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.navigationState !== this.props.navigationState) {
      this.dispatchFocusAction(nextProps);
    }
  }

  componentDidUpdate() {
    let state = this.props.navigationState
    let animation = {}
    let isPop = false
    for (var index = state.index + 1; AnimationDatas[index]; index++) {
      animation = AnimationDatas[index]
      animation.view && animation.view.add(animation.out)
      animation.view && animation.view.start()
      delete AnimationDatas[index]
      isPop = true
    }
    if (!isPop && state.index !== 0) {
      animation = AnimationDatas[state.index] || {}
      animation.view && animation.view.add(animation.in)
      animation.view && animation.view.start()

      animation = AnimationDatas[state.index - 1] || {}
      animation.view && animation.view.add(animation.overIn)
      animation.view && animation.view.start()
      animation.isDisplay = false
    }
  }

  getPanHandlers(direction, props) {
    return direction === 'vertical' ?
      NavigationCardStackPanResponder.forVertical(props) :
      NavigationCardStackPanResponder.forHorizontal(props);
  }

  dispatchFocusAction({ navigationState }) {
    if (!navigationState || navigationState.component || navigationState.tabs) {
      return;
    }
    const scene = navigationState.children[navigationState.index];
    Actions.focus({ scene });
  }

  chooseInterpolator(direction, props) {
    if (!AnimationDatas[props.navigationState.index]) {
      AnimationDatas[props.navigationState.index] = {}
    }
    const data = AnimationDatas[props.navigationState.index]
    switch (direction) {
      case 'vertical':
        AnimationDatas[props.navigationState.index] = Object.assign(data, {
          in: [{
            type: 'Alpha',
            from: 0,
            to: 1,
            duration: 0,
          }, {
              type: 'Translate',
              from2: SCREEN_HEIGHT,
              to2: 0,
              duration: 200,
            }],
        })
      // return NavigationCardStackStyleInterpolator.forVertical(props);
      case 'fade':
        AnimationDatas[props.navigationState.index] = Object.assign(data, {
          in: [
            {
              type: 'Alpha',
              from: 0,
              to: 1,
              duration: 200,
            },
          ],
        })
      // return fadeInScene(props);
      case 'leftToRight':
        AnimationDatas[props.navigationState.index] = Object.assign(data, {
          in: [{
            type: 'Alpha',
            from: 0,
            to: 1,
            duration: 0,
          }, {
              type: 'Translate',
              from: 0,
              to: SCREEN_WIDTH,
              duration: 200,
            }],
        })
      // return leftToRight(props);
      default:
        AnimationDatas[props.navigationState.index] = Object.assign(data, {
          in: [{
            type: 'Alpha',
            from: 0,
            to: 1,
            duration: 0,
          }, {
              type: 'Translate',
              from: SCREEN_WIDTH,
              to: 0,
              duration: 200,
            }],
          out: [{
            type: 'Translate',
            from: 0,
            to: SCREEN_WIDTH,
            duration: 200,
          }],
          overIn: [],
          overOut: []
        })
      // return NavigationCardStackStyleInterpolator.forHorizontal(props);
    }
    return {}
  }

  renderCard(/* NavigationSceneRendererProps */ props) {
    const { key,
      direction,
      animation,
      getSceneStyle,
      getPanHandlers,
    } = props.scene.navigationState;
    let { panHandlers, animationStyle } = props.scene.navigationState;

    const state = props.navigationState;
    const child = state.children[state.index];
    let selected = state.children[state.index];
    while (selected.hasOwnProperty('children')) {
      selected = selected.children[selected.index];
    }
    const isActive = child === selected;
    const computedProps = { isActive };
    if (isActive) {
      computedProps.hideNavBar = deepestExplicitValueForKey(props.navigationState, 'hideNavBar');
      computedProps.hideTabBar = deepestExplicitValueForKey(props.navigationState, 'hideTabBar');
    }

    const style = getSceneStyle ? getSceneStyle(props, computedProps) : null;

    // direction overrides animation if both are supplied
    const animType = (animation && !direction) ? animation : direction;

    if (typeof (animationStyle) === 'undefined') {
      animationStyle = this.chooseInterpolator(animType, props);
    }

    if (typeof (animationStyle) === 'function') {
      animationStyle = animationStyle(props);
    }

    if (typeof (panHandlers) === 'undefined') {
      panHandlers = getPanHandlers ? getPanHandlers(props) : this.getPanHandlers(direction, props);
    }

    let nowIndex = props.scene.index
    let topIndex = 0
    for (var index = nowIndex; AnimationDatas[index]; index++) {
      topIndex = index
    }
    // console.log('render card', `card_${key}`)
    return (
      <View key={`card_${key}`}
        style={[style, { backgroundColor: 'transparent' }]}>
        <AnimationView
          data={[]}
          ref={(ani) => {
            if (ani != undefined && AnimationDatas[nowIndex]) {
              AnimationDatas[nowIndex].view = ani
              // console.warn(topIndex, !!AnimationDatas[topIndex])
              if (topIndex > 0 && AnimationDatas[topIndex]) {
                AnimationDatas[topIndex].isDisplay = true
                ani.add(AnimationDatas[topIndex].overOut)
                ani.start()
              }
            }
          } }
          style={[style, {
            opacity: nowIndex > 0 && nowIndex == topIndex ? 0 : 1,
            backgroundColor: 'transparent'
          }]}>
          <NavigationCard
            {...props}
            style={[style, {
              height: SCREEN_HEIGHT, backgroundColor: 'transparent'
            }]}
            panHandlers={panHandlers}
            renderScene={this.renderScene}
            />
        </AnimationView >
      </View>
    );
  }

  renderScene(/* NavigationSceneRendererProps */ props) {
    return (
      <DefaultRenderer
        key={props.scene.navigationState.key}
        onNavigate={props.onNavigate}
        navigationState={props.scene.navigationState}
        />
    );
  }

  renderHeader(/* NavigationSceneRendererProps */ props) {
    const state = props.navigationState;
    const child = state.children[state.index];
    let selected = state.children[state.index];
    while (selected.hasOwnProperty('children')) {
      selected = selected.children[selected.index];
    }
    if (child !== selected) {
      // console.log(`SKIPPING renderHeader because ${child.key} !== ${selected.key}`);
      return null;
    }
    const hideNavBar = deepestExplicitValueForKey(state, 'hideNavBar');
    if (hideNavBar) {
      // console.log(`SKIPPING renderHeader because ${child.key} hideNavBar === true`);
      return null;
    }

    // console.log(`renderHeader for ${child.key}`);

    if (selected.component && selected.component.renderNavigationBar) {
      return selected.component.renderNavigationBar({ ...props, ...selected });
  }

  const HeaderComponent = selected.navBar || child.navBar || state.navBar || NavBar;
  const navBarProps = { ...state, ...child, ...selected };

  if(selected.component && selected.component.onRight) {
    navBarProps.onRight = selected.component.onRight;
  }

  if(selected.component && selected.component.onLeft) {
    navBarProps.onLeft = selected.component.onLeft;
  }

  if((navBarProps.leftTitle || navBarProps.leftButtonImage) && navBarProps.onLeft) {
  delete navBarProps.leftButton;
}

if ((navBarProps.rightTitle || navBarProps.rightButtonImage) && navBarProps.onRight) {
  delete navBarProps.rightButton;
}

if (navBarProps.rightButton) {
  delete navBarProps.rightTitle;
  delete navBarProps.onRight;
  delete navBarProps.rightButtonImage;
}

if (navBarProps.leftButton) {
  delete navBarProps.leftTitle;
  delete navBarProps.onLeft;
  delete navBarProps.leftButtonImage;
}
delete navBarProps.style;

const getTitle = selected.getTitle || (opts => opts.title);
return <HeaderComponent {...props} {...navBarProps} getTitle={getTitle} />;
  }

render() {
  const { navigationState, onNavigate } = this.props;

  if (!navigationState || !onNavigate) {
    console.error('navigationState and onNavigate property should be not null');
    return null;
  }

  let SceneComponent = navigationState.component;

  if (navigationState.tabs && !SceneComponent) {
    SceneComponent = TabBar;
  }

  if (SceneComponent) {
    return (
      <View
        style={[styles.sceneStyle, navigationState.sceneStyle]}
        >
        <SceneComponent {...this.props} {...navigationState} />
      </View>
    );
  }

  const optionals = {};
  const selected = navigationState.children[navigationState.index];
  const applyAnimation = selected.applyAnimation || navigationState.applyAnimation;
  const style = selected.style || navigationState.style;

  if (applyAnimation) {
    optionals.applyAnimation = applyAnimation;
  } else {
    let duration = selected.duration;
    if (duration === null || duration === undefined) duration = navigationState.duration;
    if (duration !== null && duration !== undefined) {
      optionals.applyAnimation = (pos, navState) => {
        if (duration === 0) {
          pos.setValue(navState.index);
        } else {
          Animated.timing(pos, { toValue: navState.index, duration }).start();
        }
      };
    }
  }

  // console.log(`NavigationAnimatedView for ${navigationState.key}`);

  return (
    <NavigationAnimatedView
      navigationState={navigationState}
      style={[styles.animatedView, style]}
      renderOverlay={this.renderHeader}
      renderScene={this.renderCard}
      {...optionals}
      />
  );
}
}
