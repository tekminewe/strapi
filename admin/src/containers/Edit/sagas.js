import { takeLatest } from 'redux-saga';
import { LOCATION_CHANGE } from 'react-router-redux';
import { call, cancel, fork, put, take, select } from 'redux-saga/effects';

import request from 'utils/request';
import { router } from 'app';

import {
  recordLoaded,
  recordEdited,
  recordEditError,
  recordDeleted,
  recordDeleteError,
} from './actions';
import { LOAD_RECORD, EDIT_RECORD, DELETE_RECORD } from './constants';
import {
  makeSelectCurrentModelName,
  makeSelectRecord,
  makeSelectIsCreating,
} from './selectors';

export function* getRecord(params) {
  const currentModelName = yield select(makeSelectCurrentModelName());

  try {
    const requestUrl = `${window.Strapi.apiUrl}/content-manager/explorer/${currentModelName}/${params.id}`;

    // Call our request helper (see 'utils/request')
    const response = yield call(request, requestUrl, {
      method: 'GET',
    });

    yield put(recordLoaded(response));
  } catch (err) {
    window.Strapi.notification.error('An error occurred during record fetch.');
  }
}

export function* editRecord() {
  const currentModelName = yield select(makeSelectCurrentModelName());
  const record = yield select(makeSelectRecord());
  const recordJSON = record.toJSON();

  const isCreating = yield select(makeSelectIsCreating());
  const id = isCreating ? '' : recordJSON.id;

  try {
    const requestUrl = `${window.Strapi.apiUrl}/content-manager/explorer/${currentModelName}/${id}`;

    // Call our request helper (see 'utils/request')
    yield call(request, requestUrl, {
      method: isCreating ? 'POST' : 'PUT',
      body: recordJSON,
    });

    yield put(recordEdited());
    window.Strapi.notification.success(
      `The entry has been successfully ${isCreating ? 'created' : 'updated'}.`
    );
  } catch (err) {
    yield put(recordEditError());
    window.Strapi.notification.error(
      `An error occurred during record ${isCreating ? 'creation' : 'update'}.`
    );
  }
}

export function* deleteRecord() {
  const currentModelName = yield select(makeSelectCurrentModelName());
  const record = yield select(makeSelectRecord());
  const recordJSON = record.toJSON();

  try {
    const requestUrl = `${window.Strapi.apiUrl}/content-manager/explorer/${currentModelName}/${recordJSON.id}`;

    // Call our request helper (see 'utils/request')
    yield call(request, requestUrl, {
      method: 'DELETE',
    });

    yield put(recordDeleted());
    window.Strapi.notification.success(
      'The entry has been successfully deleted.'
    );

    // Redirect to the list page.
    router.push(`/plugins/content-manager/${currentModelName}`);
  } catch (err) {
    yield put(recordDeleteError());
    window.Strapi.notification.error(
      'An error occurred during record deletion.'
    );
  }
}

export function* defaultSaga() {
  const loadRecordWatcher = yield fork(takeLatest, LOAD_RECORD, getRecord);
  const editRecordWatcher = yield fork(takeLatest, EDIT_RECORD, editRecord);
  const deleteRecordWatcher = yield fork(
    takeLatest,
    DELETE_RECORD,
    deleteRecord
  );

  // Suspend execution until location changes
  yield take(LOCATION_CHANGE);
  yield cancel(loadRecordWatcher);
  yield cancel(editRecordWatcher);
  yield cancel(deleteRecordWatcher);
}

// All sagas to be loaded
export default [defaultSaga];