/**
 * Copyright (c) 2015-present, Pavel Aksonov
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable no-param-reassign */

import {
  PUSH_ACTION,
  POP_ACTION2,
  POP_TO,
  JUMP_ACTION,
  REPLACE_ACTION,
  RESET_ACTION,
  POP_ACTION,
  REFRESH_ACTION,
} from './Actions';

import { assert } from './Util';
import { getInitialState } from './State';

// WARN: it is not working correct. rewrite it.
function checkPropertiesEqual(action, lastAction) {
  let isEqual = true;
  for (const key of Object.keys(action)) {
    if (['key', 'type', 'parent'].indexOf(key) === -1) {
      if (action[key] !== lastAction[key]) {
        isEqual = false;
      }
    }
  }
  return isEqual;
}

function inject(state, action, props, scenes) {
  const condition = action.type === REFRESH_ACTION ? state.key === props.key ||
  state.sceneKey === action.key : state.sceneKey === props.parent;
  // console.log("INJECT:", action.key, state.sceneKey, condition);
  if (!condition) {
    if (state.routes) {
      const res = state.routes.map(el => inject(el, action, props, scenes));
      let changed = false;
      let changedIndex = -1;
      for (let i = 0; i < res.length; i++) {
        if (res[i] !== state.routes[i]) {
          changed = true;
          changedIndex = i;
          break;
        }
      }
      return changed ? { ...state, routes: res, index: changedIndex } : state;
    }
    return state;
  }
  let ind;

  switch (action.type) {
    case POP_TO: {
      const targetIndex = action.targetIndex;

      return {
        ...state,
        index: targetIndex,
        routes: state.routes.slice(0, (targetIndex + 1)),
      };
    }

    case POP_ACTION2:
    case POP_ACTION:
      assert(!state.tabs, 'pop() operation cannot be run on tab bar (tabs=true)');
      if (state.index === 0) {
        return state;
      }

      return {
        ...state,
        index: state.index - 1,
        from: state.routes[state.routes.length - 1],
        routes: state.routes.slice(0, - 1),
      };
    case REFRESH_ACTION:
      return props.base ?
      { navBar: state.navBar,
        ...scenes.rootProps,
        ...props,
        key: state.key,
        from: null }
        : { ...state,
        ...props,
        key: state.key,
        from: null,
      };
    case PUSH_ACTION:
      if (state.routes[state.index].sceneKey === action.key && !props.clone
        && checkPropertiesEqual(action, state.routes[state.index])) {
        return state;
      }
      return {
        ...state,
        index: state.index + 1,
        from: null,
        routes: [...state.routes, getInitialState(props, scenes, state.index + 1, action)],
      };
    case JUMP_ACTION:
      assert(state.tabs, `Parent=${state.key} is not tab bar, jump action is not valid`);
      ind = -1;
      state.routes.forEach((c, i) => { if (c.sceneKey === action.key) { ind = i; } });
      assert(ind !== -1, `Cannot find route with key=${action.key} for parent=${state.key}`);
      return { ...state, index: ind };
    case REPLACE_ACTION:
      if (state.routes[state.index].sceneKey === action.key) {
        return state;
      }

      state.routes[state.routes.length - 1] = getInitialState(
        props,
        scenes,
        state.index,
        action
      );

      return { ...state, routes: state.routes };
    case RESET_ACTION:
      if (state.routes[state.index].sceneKey === action.key) {
        return state;
      }

      state.routes = state.routes.splice(0, 1);
      state.routes[0] = getInitialState(props, scenes, state.index, action);

      return {
        ...state,
        index: 0,
        from: null,
        routes: state.routes,
      };
    default:
      return state;
  }
}

function findElement(state, key, type) {
  if ((type === REFRESH_ACTION && state.key === key) || state.sceneKey === key) {
    return state;
  }
  if (state.routes) {
    for (const child of state.routes) {
      const current = findElement(child, key, type);
      if (current) return current;
    }
  }
  return null;
}

function getCurrent(state) {
  if (!state.routes) {
    return state;
  }
  return getCurrent(state.routes[state.index]);
}

function update(state, action, scenes) {
  // find parent in the state
  const props = { ...scenes[action.key], ...action };
  assert(props.parent, `No parent is defined for route=${action.key}`);
  return inject(state, action, props, scenes);
}

function reducer({ initialState, scenes }) {
  assert(initialState, 'initialState should not be null');
  assert(initialState.key, 'initialState.key should not be null');
  assert(scenes, 'scenes should not be null');
  return (stateParam, actionParam) => {
    let state = stateParam;
    let action = actionParam;
    state = state || initialState ;
    assert(action, 'action should be defined');
    assert(action.type, 'action type should be defined');

    if (action.key) {
      if (action.type === REFRESH_ACTION) {
        let key = action.key;
        let child = findElement(state, key, action.type) || scenes[key];
        let sceneKey = child.sceneKey;
        if (child.base) {
          child = { ...scenes[child.base], ...child };
          assert(scenes[child.base], `No scene exists for base=${child.base}`);
          key = scenes[child.base].key;
          sceneKey = scenes[child.base].sceneKey;
        }
        assert(child, `missed child data for key=${key}`);
        // evaluate functions within actions to allow conditional set, like switch values
        const evaluated = {};
        Object.keys(action).forEach(el => {
          if (typeof action[el] === 'function' && typeof child[el] !== 'undefined'
            && typeof child[el] !== typeof action[el]) {
            evaluated[el] = action[el](child[el], child);
          }
        });
        action = { ...child, ...action, ...evaluated, sceneKey, key };

        // console.log("REFRESH ACTION:", action);
      } else {
        const scene = scenes[action.key];
        assert(scene, `missed route data for key=${action.key}`);
        // clone scene
        if (scene.clone) {
          action.parent = getCurrent(state).parent;
        }
      }
    } else {
      // set current route for pop action or refresh action
      if (action.type === POP_ACTION || action.type === POP_ACTION2 ||
        action.type === REFRESH_ACTION || action.type === POP_TO) {
        if (!action.key && !action.parent) {
          action = { ...getCurrent(state), ...action };
        }
      }

      // Find the parent and index of the future state
      if (action.type === POP_TO) {
        const target = action.data;
        assert(target, 'PopTo() must be called with scene name');

        const targetEl = findElement(state, target, action.type);
        assert(targetEl, `Cannot find element name named ${target} within current state`);

        // target is a node
        let parent = targetEl.sceneKey;
        let targetIndex = 0;

        // target is child of a node
        if (!targetEl.routes) {
          const targetParent = findElement(state, targetEl.parent, action.type);
          assert(targetParent, `Cannot find parent for target ${target}`);
          parent = targetParent.sceneKey;

          targetIndex = targetParent.routes.indexOf(targetEl);
          assert(targetIndex > -1, `${target} does not belong to ${targetParent.sceneKey}`);
        }

        action.parent = parent;
        action.targetIndex = targetIndex;
      }

      // recursive pop parent
      if (action.type === POP_ACTION || action.type === POP_ACTION2) {
        const parent = action.parent || scenes[action.key].parent;
        let el = findElement(state, parent, action.type);
        while (el.parent && (el.routes.length <= 1 || el.tabs)) {
          el = findElement(state, el.parent, action.type);
          assert(el, `Cannot find element for parent=${el.parent} within current state`);
        }
        action.parent = el.sceneKey;
      }
    }

    switch (action.type) {
      case POP_ACTION2:
      case POP_ACTION:
      case POP_TO:
      case REFRESH_ACTION:
      case PUSH_ACTION:
      case JUMP_ACTION:
      case REPLACE_ACTION:
      case RESET_ACTION:
        return update(state, action, scenes);

      default:
        return state;

    }
  };
}

export default reducer;
