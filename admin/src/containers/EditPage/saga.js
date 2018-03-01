import { LOCATION_CHANGE } from 'react-router-redux';
import { get, isArray, isEmpty,   isNumber, isString, map } from 'lodash';
import {
  call,
  cancel,
  fork,
  put,
  select,
  take,
  takeLatest,
} from 'redux-saga/effects';

// Utils.
import cleanData from 'utils/cleanData';
import request from 'utils/request';
import templateObject from 'utils/templateObject';

import { getDataSucceeded, setFormErrors, submitSuccess } from './actions';
import { GET_DATA,SUBMIT } from './constants';
import {
  makeSelectFileRelations,
  makeSelectIsCreating,
  makeSelectModelName,
  makeSelectRecord,
  makeSelectSource,
} from './selectors';

function* dataGet(action) {
  try {
    const modelName = yield select(makeSelectModelName());
    const params = { source: action.source };
    const response = yield call(
      request,
      `/content-manager/explorer/${modelName}/${action.id}`,
      { method: 'GET', params },
    );

    const pluginHeaderTitle = yield call(templateObject, { mainField: action.mainField }, response);
    yield put(getDataSucceeded(action.id, response, pluginHeaderTitle.mainField));
  } catch(err) {
    strapi.notification.error('content-manager.error.record.fetch');
  }
}

export function* submit() {
  const currentModelName = yield select(makeSelectModelName());
  const fileRelations = yield select(makeSelectFileRelations());
  const isCreating = yield select(makeSelectIsCreating());
  const record = yield select(makeSelectRecord());
  const source = yield select(makeSelectSource());

  try {
    const recordCleaned = Object.keys(record).reduce((acc, current) => {
      const cleanedData = cleanData(record[current], 'value', 'id');

      if (isString(cleanedData) || isNumber(cleanedData)) {
        acc.append(current, cleanedData);
      } else if (fileRelations.includes(current)) {
        // Don't stringify the file
        map(record[current], (file) => {
          if (file instanceof File) {
            return acc.append(current, file);
          }

          return acc.append(current, JSON.stringify(file));
        });

        if (isEmpty(record[current])) {
          acc.append(current, JSON.stringify([]));
        }
      } else {
        acc.append(current, JSON.stringify(cleanedData));
      }

      return acc;
    }, new FormData());

    // for(var pair of recordCleaned.entries()) {
    //   console.log(pair[0]+ ', '+ pair[1]);
    // }

    const id = isCreating ? '' : record.id;
    const params = { source };
    // Change the request helper default headers so we can pass a FormData
    const headers = {
      'X-Forwarded-Host': 'strapi',
    };

    const requestUrl = `/content-manager/explorer/${currentModelName}/${id}`;

    // Call our request helper (see 'utils/request')
    // Pass false and false as arguments so the request helper doesn't stringify
    // the body and doesn't watch for the server to restart
    yield call(request, requestUrl, {
      method: isCreating ? 'POST' : 'PUT',
      headers,
      body: recordCleaned,
      params,
    }, false, false);

    strapi.notification.success('content-manager.success.record.save');
    // Redirect the user to the ListPage container
    yield put(submitSuccess());

  } catch(err) {
    // NOTE: leave the error log
    console.log(err.response);
    if (isArray(err.response.payload.message)) {
      const errors = err.response.payload.message.reduce((acc, current) => {
        const error = current.messages.reduce((acc, current) => {
          acc.errorMessage = current.id;

          return acc;
        }, { id: 'components.Input.error.custom-error', errorMessage: '' });
        acc.push(error);

        return acc;
      }, []);

      const name = get(err.response.payload.message, ['0', 'messages', '0', 'field']);

      yield put(setFormErrors([{ name, errors }]));
    }
    strapi.notification.error(isCreating ? 'content-manager.error.record.create' : 'content-manager.error.record.update');
  }
}

function* defaultSaga() {
  const loadDataWatcher = yield fork(takeLatest, GET_DATA, dataGet);
  yield fork(takeLatest, SUBMIT, submit);

  yield take(LOCATION_CHANGE);

  yield cancel(loadDataWatcher);
}

export default defaultSaga;
