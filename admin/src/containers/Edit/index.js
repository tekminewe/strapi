/*
 *
 * Edit
 *
 */

import React from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import { compose } from 'redux';
// import _ from 'lodash';

import { router } from 'app';

import PluginHeader from 'components/PluginHeader';
import Container from 'components/Container';
import EditForm from 'components/EditForm';
import { makeSelectSchema } from 'containers/App/selectors';
import EditFormRelations from 'components/EditFormRelations';

import injectReducer from 'utils/injectReducer';
import injectSaga from 'utils/injectSaga';

import {
  setInitialState,
  setCurrentModelName,
  setIsCreating,
  loadRecord,
  setRecordAttribute,
  editRecord,
  deleteRecord,
} from './actions';
import {
  makeSelectRecord,
  makeSelectLoading,
  makeSelectCurrentModelName,
  makeSelectEditing,
  makeSelectDeleting,
  makeSelectIsCreating,
} from './selectors';
import reducer from './reducer';
import saga from './sagas';

export class Edit extends React.Component {
  componentWillMount() {
    this.props.setInitialState();
    this.props.setCurrentModelName(this.props.match.params.slug.toLowerCase());

    // Detect that the current route is the `create` route or not
    if (this.props.match.params.id === 'create') {
      this.props.setIsCreating();
    } else {
      this.props.loadRecord(this.props.match.params.id);
    }
  }

  render() {
    let content = <p>Loading...</p>;
    let relations;
    if (!this.props.loading && this.props.schema && this.props.currentModelName) {
      content = (
        <EditForm
          record={this.props.record}
          currentModelName={this.props.currentModelName}
          schema={this.props.schema}
          setRecordAttribute={this.props.setRecordAttribute}
          editRecord={this.props.editRecord}
          editing={this.props.editing}
        />
      );
      relations = (
        <EditFormRelations
          currentModelName={this.props.currentModelName}
          record={this.props.record}
          schema={this.props.schema}
          setRecordAttribute={this.props.setRecordAttribute}
        />
      );
    }

    // Define plugin header actions
    const pluginHeaderActions = [
      {
        label: 'content-manager.containers.Edit.cancel',
        class: 'btn-default',
        onClick: () => {
          router.push(`/plugins/content-manager/${this.props.currentModelName}`);
        },
      },
      {
        label: this.props.editing ? 'content-manager.containers.Edit.editing' : 'content-manager.containers.Edit.submit',
        class: 'btn-primary',
        onClick: this.props.editRecord,
        disabled: this.props.editing,
      },
    ];

    // Add the `Delete` button only in edit mode
    if (!this.props.isCreating) {
      pluginHeaderActions.push({
        label: 'content-manager.containers.Edit.delete',
        class: 'btn-danger',
        onClick: this.props.deleteRecord,
        disabled: this.props.deleting,
      });
    }

    // Plugin header config
    const pluginHeaderTitle = _.get(this.props.schema, [this.props.currentModelName, 'label']) || 'Content Manager';
    const pluginHeaderDescription = this.props.isCreating
      ? 'New entry'
      : `#${this.props.record && this.props.record.get('id')}`;

    return (
      <div className="col-md-12">
        <div className="container-fluid">
          <PluginHeader
            title={pluginHeaderTitle}
            description={{
              id: 'plugin-content-manager-description',
              defaultMessage: `${pluginHeaderDescription}`,
            }}
            actions={pluginHeaderActions}
          />
          <Container>
            <div className="row">
              <div className="col-md-8">
                {content}
                {relations}
              </div>
            </div>
          </Container>
        </div>
      </div>
    );
  }
}

Edit.propTypes = {
  currentModelName: React.PropTypes.oneOfType([
    React.PropTypes.bool,
    React.PropTypes.string,
  ]).isRequired,
  deleteRecord: React.PropTypes.func.isRequired,
  deleting: React.PropTypes.bool.isRequired,
  editing: React.PropTypes.bool.isRequired,
  editRecord: React.PropTypes.func.isRequired,
  isCreating: React.PropTypes.bool.isRequired,
  loading: React.PropTypes.bool.isRequired,
  loadRecord: React.PropTypes.func.isRequired,
  match: React.PropTypes.object.isRequired,
  record: React.PropTypes.oneOfType([
    React.PropTypes.object,
    React.PropTypes.bool,
  ]).isRequired,
  schema: React.PropTypes.oneOfType([
    React.PropTypes.object,
    React.PropTypes.bool,
  ]).isRequired,
  setCurrentModelName: React.PropTypes.func.isRequired,
  setInitialState: React.PropTypes.func.isRequired,
  setIsCreating: React.PropTypes.func.isRequired,
  setRecordAttribute: React.PropTypes.func.isRequired,
};

const mapStateToProps = createStructuredSelector({
  record: makeSelectRecord(),
  loading: makeSelectLoading(),
  currentModelName: makeSelectCurrentModelName(),
  editing: makeSelectEditing(),
  deleting: makeSelectDeleting(),
  isCreating: makeSelectIsCreating(),
  schema: makeSelectSchema(),
});

function mapDispatchToProps(dispatch) {
  return {
    setInitialState: () => dispatch(setInitialState()),
    setCurrentModelName: currentModelName =>
      dispatch(setCurrentModelName(currentModelName)),
    setIsCreating: () => dispatch(setIsCreating()),
    loadRecord: id => dispatch(loadRecord(id)),
    setRecordAttribute: (key, value) =>
      dispatch(setRecordAttribute(key, value)),
    editRecord: () => dispatch(editRecord()),
    deleteRecord: () => {
      // TODO: improve confirmation UX.
      if (window.confirm('Are you sure ?')) {
        // eslint-disable-line no-alert
        dispatch(deleteRecord());
      }
    },
    dispatch,
  };
}

const withConnect = connect(mapStateToProps, mapDispatchToProps);

const withReducer = injectReducer({ key: 'edit', reducer });
const withSaga = injectSaga({ key: 'edit', saga });

export default compose(
  withReducer,
  withSaga,
  withConnect,
)(Edit);
