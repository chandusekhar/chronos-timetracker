import JiraClient from 'jira-connector';
import storage from 'electron-json-storage';
import isOnline from 'is-online';
import { staticUrl } from 'config';

import { success, fail } from '../helpers/promise';
import * as types from '../constants';
import Socket from '../socket';

export function installUpdates() {
  return {
    type: types.INSTALL_UPDATES,
  };
}

export function checkConnection() {
  return dispatch => {
    isOnline()
      .then(
        online => dispatch({
          type: types.SET_CONNECTION_STATUS,
          payload: online,
        })
      );
  }
}

export function jwtConnect(token) {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    dispatch({
      type: types.SET_CONNECT_FETCH_STATE,
      payload: true,
    });
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const url = `${staticUrl}/desktop-tracker/authenticate`;
    fetch(url, options)
      .then(
        (res) => {
          if (res.status === 200) {
            return res.json();
          } else if (res.status === 401) {
            storage.remove('desktop_tracker_jwt', () => {
              dispatch({
                type: types.THROW_ERROR,
                error: 'Automatic login failed, please enter your credentials again',
              });
              dispatch({
                type: types.SET_CONNECT_FETCH_STATE,
                payload: false,
              });
              reject(fail('Failed'));
            });
          } else {
            storage.remove('desktop_tracker_jwt', () => {
              dispatch({
                type: types.THROW_ERROR,
                error: 'Automatic login failed, please enter your credentials again',
              });
              dispatch({
                type: types.SET_CONNECT_FETCH_STATE,
                payload: false,
              });
              reject(fail('Failed'));
            });
            dispatch({
              type: types.THROW_ERROR,
              error: 'Server error',
            });
            dispatch({
              type: types.SET_CONNECT_FETCH_STATE,
              payload: false,
            });
            reject(fail('Server error'));
          }
        },
      )
      .then(
        (json) => {
          const { baseUrl, username, password } = json;
          const host = baseUrl;
          const jiraClient = new JiraClient({
            host,
            basic_auth: {
              username,
              password,
            },
          });
          if (!jiraClient) return;
          Socket.login(
            dispatch,
            getState
          );
          jiraClient.myself.getMyself({}, (err2, response) => {
            if (err2) {
              dispatch({
                type: types.THROW_ERROR,
                error: 'Something went wrong with JIRA. Please check credentials and try again',
              });
              dispatch({
                type: types.SET_CONNECT_FETCH_STATE,
                payload: false,
              });
              reject(fail(err2));
            } else {
              dispatch({
                type: types.GET_SELF,
                self: response,
              });
              dispatch({
                type: types.CONNECT,
                jiraClient,
                credentials: {
                  host,
                  username,
                  memorize: true, // temp
                },
              });
              dispatch({
                type: types.SET_CONNECT_FETCH_STATE,
                payload: false,
              });
              resolve(success());
            }
          });
        },
      );
  });
}

export function connect(credentials) {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    dispatch({
      type: types.SET_CONNECT_FETCH_STATE,
      payload: true,
    });
    const { host, username, password, memorize } = credentials.toJS();
    let formatHost = host.startsWith('https://') ? host.slice(8) : host;
    formatHost = formatHost.startsWith('http://') ? formatHost.slice(7) : formatHost;
    const jiraClient = new JiraClient({
      host: `${formatHost}.atlassian.net`,
      basic_auth: {
        username,
        password,
      },
    });
    if (!jiraClient) return;
    jiraClient.myself.getMyself({}, (err, response) => {
      if (err) {
        dispatch({
          type: types.THROW_ERROR,
          error: 'Cannot authorize to JIRA. Check your credentials and try again',
        });
        dispatch({
          type: types.SET_CONNECT_FETCH_STATE,
          payload: false,
        });
        reject(fail(err));
      } else {
        dispatch({
          type: types.GET_SELF,
          self: response,
        });
        const url = `${staticUrl}/desktop-tracker/authenticate`;
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            baseUrl: `${formatHost}.atlassian.net`,
            username,
            password,
          }),
        };
        fetch(url, options)
          .then(
            res => res.status === 200 && res.json(),
          )
          .then(
            (json) => {
              dispatch({
                type: types.CONNECT,
                jiraClient,
                credentials: {
                  host,
                  username,
                  memorize,
                },
              });
              dispatch({
                type: types.SET_AUTH_SUCCEEDED,
              });
              const token = json.token;
              if (token) {
                Socket.login(
                  dispatch,
                  getState
                );
                dispatch({
                  type: types.SAVE_JWT,
                  token,
                });
              }
              if (memorize) {
                dispatch({
                  type: types.MEMORIZE_FORM,
                  data: {
                    host,
                    username,
                  },
                });
              }
              dispatch({
                type: types.SET_CONNECT_FETCH_STATE,
                payload: false,
              });
              resolve(success);
            },
          );
      }
    });
  });
}

export function getSavedCredentials() {
  return dispatch => new Promise((resolve, reject) => {
    storage.get('jira_credentials', (error, credentials) => {
      if (error) {
        dispatch({
          type: types.THROW_ERROR,
          error,
        });
        dispatch({
          type: types.SET_CONNECT_FETCH_STATE,
          payload: false,
        });
        reject(fail(error));
      }
      dispatch({
        type: types.GET_SAVED_CREDENTIALS,
        credentials,
      });
      resolve(success(credentials));
    });
  });
}

export function getJWT() {
  return dispatch => new Promise((resolve, reject) => {
    storage.get('desktop_tracker_jwt', (error, token) => {
      if (error || !token.length) {
        dispatch({
          type: types.THROW_ERROR,
          error,
        });
        dispatch({
          type: types.SET_CONNECT_FETCH_STATE,
          payload: false,
        });
        reject(fail(error));
      }
      dispatch({
        type: types.GET_JWT,
        token,
      });
      resolve(success({ token }));
    });
  });
}


export function logout() {
  return dispatch => {
    dispatch({
      type: types.CLEAR_ISSUES,
    });
    dispatch({
      type: types.CLEAR_PROJECTS,
    });
    dispatch({
      type: types.LOGOUT,
    });
  };
}

export function setAuthSucceeded() {
  return {
    type: types.SET_AUTH_SUCCEEDED,
  };
}