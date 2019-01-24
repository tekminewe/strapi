/**
 *
 * EditPage
 *
 */

import React from 'react';
import moment from 'moment';
import { connect } from 'react-redux';
import { bindActionCreators, compose } from 'redux';
import { createStructuredSelector } from 'reselect';
import PropTypes from 'prop-types';
import {
  cloneDeep,
  findIndex,
  get,
  includes,
  isEmpty,
  isObject,
  toNumber,
  toString,
  replace,
} from 'lodash';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';
import cn from 'classnames';
// You can find these components in either
// ./node_modules/strapi-helper-plugin/lib/src
// or strapi/packages/strapi-helper-plugin/lib/src
import BackHeader from 'components/BackHeader';
import EmptyAttributesBlock from 'components/EmptyAttributesBlock';
import LoadingIndicator from 'components/LoadingIndicator';
import PluginHeader from 'components/PluginHeader';
import PopUpWarning from 'components/PopUpWarning';
// Plugin's components
import CustomDragLayer from 'components/CustomDragLayer';
import Edit from 'components/Edit';
import EditRelations from 'components/EditRelations';
// App selectors
import { makeSelectSchema } from 'containers/App/selectors';
import injectReducer from 'utils/injectReducer';
import injectSaga from 'utils/injectSaga';
import getQueryParameters from 'utils/getQueryParameters';
import { bindLayout } from 'utils/bindLayout';
import inputValidations from 'utils/inputsValidations';
import { generateRedirectURI } from 'containers/ListPage/utils';
import { checkFormValidity } from 'utils/formValidations';
import {
  addRelationItem,
  changeData,
  deleteData,
  getData,
  initModelProps,
  moveAttr,
  moveAttrEnd,
  onCancel,
  onRemoveRelationItem,
  resetProps,
  setFileRelations,
  setFormErrors,
  submit,
} from './actions';
import reducer from './reducer';
import saga from './saga';
import makeSelectEditPage from './selectors';
import styles from './styles.scss';

export class EditPage extends React.Component {
  state = { showWarning: false, showWarningDelete: false };

  componentDidMount() {
    this.initComponent(this.props);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location.pathname !== this.props.location.pathname) {
      this.props.resetProps();
      this.initComponent(this.props);
    }

    if (prevProps.editPage.submitSuccess !== this.props.editPage.submitSuccess) {
      if (
        !isEmpty(this.props.location.search) &&
        includes(this.props.location.search, '?redirectUrl')
      ) {
        const redirectUrl = this.props.location.search.split('?redirectUrl=')[1];

        this.props.history.push({
          pathname: redirectUrl.split('?')[0],
          search: redirectUrl.split('?')[1],
        });
      } else {
        this.props.history.push({
          pathname: replace(this.props.location.pathname, '/create', ''),
          search: `?source=${this.getSource()}`,
        });
      }
    }
  }

  componentWillUnmount() {
    this.props.resetProps();
  }

  /**
   * Retrieve the model's displayed relations
   * @return {Array}
   */
  getDisplayedRelations = () => {
    return get(this.getSchema(), ['editDisplay', 'relations'], []);
  };

  /**
   * Retrieve the model's custom layout
   *
   */
  getLayout = () =>
    bindLayout.call(this, get(this.props.schema, ['layout', this.getModelName()], {}));

  /**
   *
   *
   * @type {[type]}
   */
  getAttributeValidations = name =>
    get(
      this.props.editPage.formValidations,
      [findIndex(this.props.editPage.formValidations, ['name', name]), 'validations'],
      {},
    );

  getDisplayedFields = () => get(this.getSchema(), ['editDisplay', 'fields'], []);

  /**
   * Retrieve the model
   * @type {Object}
   */
  getModel = () =>
    get(this.props.schema, ['models', this.getModelName()]) ||
    get(this.props.schema, ['models', 'plugins', this.getSource(), this.getModelName()]);

  /**
   * Retrieve specific attribute
   * @type {String} name
   */
  getModelAttribute = name => get(this.getModelAttributes(), name);

  /**
   * Retrieve the model's attributes
   * @return {Object}
   */
  getModelAttributes = () => this.getModel().attributes;

  /**
   * Retrieve the model's name
   * @return {String} model's name
   */
  getModelName = () => this.props.match.params.slug.toLowerCase();

  /**
   * Retrieve model's schema
   * @return {Object}
   */
  getSchema = () =>
    this.getSource() !== 'content-manager'
      ? get(this.props.schema, ['models', 'plugins', this.getSource(), this.getModelName()])
      : get(this.props.schema, ['models', this.getModelName()]);

  getPluginHeaderTitle = () => {
    if (this.isCreating()) {
      return toString(this.props.editPage.pluginHeaderTitle);
    }
    const primaryKey = this.getModel().primaryKey;
    const { match: { params: { id } } } = this.props;
    const title = get(this.getSchema(), 'editDisplay.displayedField', primaryKey);
    const valueToDisplay = get(this.props.editPage, ['initialRecord', title], id);

    return isEmpty(valueToDisplay) ? id : valueToDisplay;
  };

  /**
   * Retrieve the model's source
   * @return {String}
   */
  getSource = () => getQueryParameters(this.props.location.search, 'source');

  /**
   * Initialize component
   */
  initComponent = props => {
    this.props.initModelProps(
      this.getModelName(),
      this.isCreating(),
      this.getSource(),
      this.getModelAttributes(),
      this.getDisplayedFields(),
    );

    if (!this.isCreating()) {
      const mainField = get(this.getModel(), 'info.mainField') || this.getModel().primaryKey;
      this.props.getData(props.match.params.id, this.getSource(), mainField);
    }

    // Get all relations made with the upload plugin
    const fileRelations = Object.keys(get(this.getSchema(), 'relations', {})).reduce(
      (acc, current) => {
        const association = get(this.getSchema(), ['relations', current], {});

        if (association.plugin === 'upload' && association[association.type] === 'file') {
          const relation = {
            name: current,
            multiple: association.nature === 'manyToManyMorph',
          };

          acc.push(relation);
        }
        return acc;
      },
      [],
    );

    // Update the reducer so we can use it to create the appropriate FormData in the saga
    this.props.setFileRelations(fileRelations);
  };

  handleAddRelationItem = ({ key, value }) => {
    this.props.addRelationItem({
      key,
      value,
    });
  };

  handleBlur = ({ target }) => {
    const defaultValue = get(this.getModelAttribute(target.name), 'default');

    if (isEmpty(target.value) && defaultValue && target.value !== false) {
      return this.props.changeData({
        target: {
          name: `record.${target.name}`,
          value: defaultValue,
        },
      });
    }

    const errorIndex = findIndex(this.props.editPage.formErrors, ['name', target.name]);
    const errors = inputValidations(
      target.value,
      this.getAttributeValidations(target.name),
      target.type,
    );
    const formErrors = cloneDeep(this.props.editPage.formErrors);

    if (errorIndex === -1 && !isEmpty(errors)) {
      formErrors.push({ name: target.name, errors });
    } else if (errorIndex !== -1 && isEmpty(errors)) {
      formErrors.splice(errorIndex, 1);
    } else if (!isEmpty(errors)) {
      formErrors.splice(errorIndex, 1, { name: target.name, errors });
    }

    return this.props.setFormErrors(formErrors);
  };

  handleChange = e => {
    let value = e.target.value;
    // Check if date
    if (isObject(e.target.value) && e.target.value._isAMomentObject === true) {
      value = moment(e.target.value).format('YYYY-MM-DD HH:mm:ss');
    } else if (
      ['float', 'integer', 'biginteger', 'decimal'].indexOf(
        get(this.getSchema(), ['fields', e.target.name, 'type']),
      ) !== -1
    ) {
      value = toNumber(e.target.value);
    }

    const target = {
      name: `record.${e.target.name}`,
      value,
    };

    this.props.changeData({ target });
  };

  handleConfirm = () => {
    const { showWarningDelete } = this.state;

    if (showWarningDelete) {
      this.props.deleteData();
      this.toggleDelete();
    } else {
      this.props.onCancel();
      this.toggle();
    }
  };

  handleGoBack = () => this.props.history.goBack();

  handleRedirect = ({ model, id, source = 'content-manager' }) => {
    /* eslint-disable */
    switch (model) {
      case 'permission':
      case 'role':
      case 'file':
        // Exclude special models which are handled by plugins.
        if (source !== 'content-manager') {
          break;
        }
      default:
        const pathname = `${this.props.match.path.replace(':slug', model).replace(':id', id)}`;

        this.props.history.push({
          pathname,
          search: `?source=${source}&redirectURI=${generateRedirectURI({
            model,
            search: `?source=${source}`,
          })}`,
        });
    }
    /* eslint-enable */
  };

  handleSubmit = e => {
    e.preventDefault();
    const formErrors = checkFormValidity(
      this.generateFormFromRecord(),
      this.props.editPage.formValidations,
    );

    if (isEmpty(formErrors)) {
      this.props.submit();
    }

    this.props.setFormErrors(formErrors);
  };

  hasDisplayedRelations = () => {
    return this.getDisplayedRelations().length > 0;
  };

  hasDisplayedFields = () => {
    return get(this.getModel(), ['editDisplay', 'fields'], []).length > 0;
  };

  isCreating = () => this.props.match.params.id === 'create';

  isRelationComponentNull = () =>
    Object.keys(get(this.getSchema(), 'relations', {})).filter(
      relation =>
        get(this.getSchema(), ['relations', relation, 'plugin']) !== 'upload' &&
        (!get(this.getSchema(), ['relations', relation, 'nature'], '')
          .toLowerCase()
          .includes('morph') ||
          !get(this.getSchema(), ['relations', relation, relation])),
    ).length === 0;

  // NOTE: technical debt that needs to be redone
  generateFormFromRecord = () =>
    Object.keys(this.getModelAttributes()).reduce((acc, current) => {
      acc[current] = get(this.props.editPage.record, current, '');

      return acc;
    }, {});

  pluginHeaderActions = () => [
    {
      label: 'content-manager.containers.Edit.reset',
      kind: 'secondary',
      onClick: this.toggle,
      type: 'button',
      disabled: this.showLoaders(),
    },
    {
      kind: 'primary',
      label: 'content-manager.containers.Edit.submit',
      onClick: this.handleSubmit,
      type: 'submit',
      loader: this.props.editPage.showLoader,
      style: this.props.editPage.showLoader
        ? { marginRight: '18px', flexGrow: 2 }
        : { flexGrow: 2 },
      disabled: this.showLoaders(),
    },
  ];

  pluginHeaderSubActions = () => {
    /* eslint-disable indent */
    const subActions = this.isCreating()
      ? []
      : [
          {
            label: 'app.utils.delete',
            kind: 'delete',
            onClick: this.toggleDelete,
            type: 'button',
            disabled: this.showLoaders(),
          },
        ];

    return subActions;
    /* eslint-enable indent */
  };

  showLoaders = () => {
    const {
      editPage: { isLoading },
      schema: { layout },
    } = this.props;

    return (
      (isLoading && !this.isCreating()) ||
      (isLoading && get(layout, this.getModelName()) === undefined)
    );
  };

  toggle = () => this.setState(prevState => ({ showWarning: !prevState.showWarning }));

  toggleDelete = () =>
    this.setState(prevState => ({ showWarningDelete: !prevState.showWarningDelete }));

  renderEdit = () => {
    const {
      editPage,
      location: { search },
    } = this.props;
    const source = getQueryParameters(search, 'source');
    const basePath = '/plugins/content-manager/ctm-configurations';
    const pathname =
      source !== 'content-manager'
        ? `${basePath}/plugins/${source}/${this.getModelName()}`
        : `${basePath}/${this.getModelName()}`;

    if (this.showLoaders()) {
      return (
        <div className={!this.hasDisplayedRelations() ? 'col-lg-12' : 'col-lg-9'}>
          <div className={styles.main_wrapper}>
            <LoadingIndicator />
          </div>
        </div>
      );
    }

    if (!this.hasDisplayedFields()) {
      return (
        <div className={!this.hasDisplayedRelations() ? 'col-lg-12' : 'col-lg-9'}>
          <EmptyAttributesBlock
            description="content-manager.components.EmptyAttributesBlock.description"
            label="content-manager.components.EmptyAttributesBlock.button"
            onClick={() => this.props.history.push(pathname)}
          />
        </div>
      );
    }

    return (
      <div className={!this.hasDisplayedRelations() ? 'col-lg-12' : 'col-lg-9'}>
        <div className={styles.main_wrapper}>
          <Edit
            attributes={this.getModelAttributes()}
            didCheckErrors={editPage.didCheckErrors}
            formValidations={editPage.formValidations}
            formErrors={editPage.formErrors}
            layout={this.getLayout()}
            modelName={this.getModelName()}
            onBlur={this.handleBlur}
            onChange={this.handleChange}
            record={editPage.record}
            resetProps={editPage.resetProps}
            schema={this.getSchema()}
          />
        </div>
      </div>
    );
  };

  render() {
    const { editPage, moveAttr, moveAttrEnd } = this.props;
    const { showWarning, showWarningDelete } = this.state;

    return (
      <div>
        <form onSubmit={this.handleSubmit}>
          <BackHeader onClick={this.handleGoBack} />
          <CustomDragLayer />
          <div className={cn('container-fluid', styles.containerFluid)}>
            <PluginHeader
              actions={this.pluginHeaderActions()}
              subActions={this.pluginHeaderSubActions()}
              title={{ id: this.getPluginHeaderTitle() }}
              titleId="addNewEntry"
            />
            <PopUpWarning
              isOpen={showWarning}
              toggleModal={this.toggle}
              content={{
                title: 'content-manager.popUpWarning.title',
                message: 'content-manager.popUpWarning.warning.cancelAllSettings',
                cancel: 'content-manager.popUpWarning.button.cancel',
                confirm: 'content-manager.popUpWarning.button.confirm',
              }}
              popUpWarningType="danger"
              onConfirm={this.handleConfirm}
            />
            <PopUpWarning
              isOpen={showWarningDelete}
              toggleModal={this.toggleDelete}
              content={{
                title: 'content-manager.popUpWarning.title',
                message: 'content-manager.popUpWarning.bodyMessage.contentType.delete',
                cancel: 'content-manager.popUpWarning.button.cancel',
                confirm: 'content-manager.popUpWarning.button.confirm',
              }}
              popUpWarningType="danger"
              onConfirm={this.handleConfirm}
            />
            <div className="row">
              {this.renderEdit()}
              {this.hasDisplayedRelations() && (
                <div className={cn('col-lg-3')}>
                  <div className={styles.sub_wrapper}>
                    {this.hasDisplayedRelations() && (
                      <EditRelations
                        changeData={this.props.changeData}
                        currentModelName={this.getModelName()}
                        displayedRelations={this.getDisplayedRelations()}
                        isDraggingSibling={editPage.isDraggingSibling}
                        location={this.props.location}
                        moveAttr={moveAttr}
                        moveAttrEnd={moveAttrEnd}
                        onAddRelationalItem={this.handleAddRelationItem}
                        onRedirect={this.handleRedirect}
                        onRemoveRelationItem={this.props.onRemoveRelationItem}
                        record={editPage.record}
                        schema={this.getSchema()}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }
}

EditPage.contextTypes = {
  plugins: PropTypes.object,
};

EditPage.defaultProps = {
  schema: {},
};

EditPage.propTypes = {
  addRelationItem: PropTypes.func.isRequired,
  changeData: PropTypes.func.isRequired,
  deleteData: PropTypes.func.isRequired,
  editPage: PropTypes.object.isRequired,
  getData: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  initModelProps: PropTypes.func.isRequired,
  location: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  moveAttr: PropTypes.func.isRequired,
  moveAttrEnd: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onRemoveRelationItem: PropTypes.func.isRequired,
  resetProps: PropTypes.func.isRequired,
  schema: PropTypes.object,
  setFileRelations: PropTypes.func.isRequired,
  setFormErrors: PropTypes.func.isRequired,
  submit: PropTypes.func.isRequired,
};

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      addRelationItem,
      changeData,
      deleteData,
      getData,
      initModelProps,
      moveAttr,
      moveAttrEnd,
      onCancel,
      onRemoveRelationItem,
      resetProps,
      setFileRelations,
      setFormErrors,
      submit,
    },
    dispatch,
  );
}

const mapStateToProps = createStructuredSelector({
  editPage: makeSelectEditPage(),
  schema: makeSelectSchema(),
});

const withConnect = connect(
  mapStateToProps,
  mapDispatchToProps,
);

const withReducer = injectReducer({ key: 'editPage', reducer });
const withSaga = injectSaga({ key: 'editPage', saga });

export default compose(
  withReducer,
  withSaga,
  withConnect,
)(DragDropContext(HTML5Backend)(EditPage));
