/*
 *
 * List
 *
 */

import React from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import _ from 'lodash';
import { define } from 'i18n';

import { makeSelectModels, makeSelectSchema } from 'containers/App/selectors';
import Container from 'components/Container';
import Table from 'components/Table';
import TableFooter from 'components/TableFooter';

import styles from './styles.scss';
import {
  setCurrentModelName,
  loadRecords,
  loadCount,
  changePage,
  changeSort,
  changeLimit,
} from './actions';
import {
  makeSelectRecords,
  makeSelectLoadingRecords,
  makeSelectCurrentModelName,
  makeSelectCurrentModelNamePluralized,
  makeSelectCount,
  makeSelectCurrentPage,
  makeSelectLimit,
  makeSelectSort,
  makeSelectLoadingCount,
} from './selectors';
import messages from './messages.json';

define(messages);

export class List extends React.Component {
  componentWillMount() {
    // Init the view
    this.init(this.props.routeParams.slug);
  }

  componentWillReceiveProps(nextProps) {
    // Check if the current slug changed in the url
    const locationChanged =
      nextProps.location.pathname !== this.props.location.pathname;

    // If the location changed, init the view
    if (locationChanged) {
      this.init(nextProps.params.slug);
    }
  }

  init(slug) {
    // Set current model name
    this.props.setCurrentModelName(slug.toLowerCase());

    // Set default sort value
    this.props.changeSort(this.props.models[slug.toLowerCase()].primaryKey);

    // Load records
    this.props.loadRecords();

    // Get the records count
    this.props.loadCount();

    // Define the `create` route url
    this.addRoute = `${this.props.route.path.replace(':slug', slug)}/create`;
  }

  render() {
    if (!this.props.currentModelName || !this.props.schema) {
      return <div />;
    }

    const PluginHeader = this.props.exposedComponents.PluginHeader;

    let content;
    if (this.props.loadingRecords) {
      content = (
        <div>
          <p>Loading...</p>
        </div>
      );
    } else if (!this.props.records.length) {
      content = <p>No results.</p>;
    } else {
      // Detect current model structure from models list
      const currentModel = this.props.models[this.props.currentModelName];

      // Define table headers
      const tableHeaders = _.map(this.props.schema[this.props.currentModelName].list, (value) => ({
        name: value,
        label: this.props.schema[this.props.currentModelName].fields[value].label,
        type: this.props.schema[this.props.currentModelName].fields[value].type,
      }));

      content = (
        <Table
          records={this.props.records}
          route={this.props.route}
          routeParams={this.props.routeParams}
          headers={tableHeaders}
          changeSort={this.props.changeSort}
          sort={this.props.sort}
          history={this.props.history}
          primaryKey={currentModel.primaryKey || 'id'}
        />
      );
    }

    // Define plugin header actions
    const pluginHeaderActions = [
      {
        label: messages.addAnEntry,
        class: 'btn-primary',
        onClick: () => this.context.router.push(this.addRoute),
      },
    ];

    // Plugin header config
    const pluginHeaderTitle = this.props.schema[this.props.currentModelName].label || 'Content Manager';
    messages.pluginHeaderDescription.values = {
      label: this.props.schema[this.props.currentModelName].labelPlural.toLowerCase(),
    };

    return (
      <div>
        <div className={`container-fluid ${styles.containerFluid}`}>
          <PluginHeader
            title={{
              id: 'plugin-content-manager-title',
              defaultMessage: `${pluginHeaderTitle}`,
            }}
            description={messages.pluginHeaderDescription}
            actions={pluginHeaderActions}
          />
          <Container>
            {content}
            <TableFooter
              limit={this.props.limit}
              currentPage={this.props.currentPage}
              changePage={this.props.changePage}
              count={this.props.count}
              className="push-lg-right"
              onLimitChange={this.props.onLimitChange}
            />
          </Container>
        </div>
      </div>
    );
  }
}

List.contextTypes = {
  router: React.PropTypes.object.isRequired,
};

List.propTypes = {
  changePage: React.PropTypes.func.isRequired,
  changeSort: React.PropTypes.func.isRequired,
  count: React.PropTypes.oneOfType([
    React.PropTypes.number,
    React.PropTypes.bool,
  ]),
  currentModelName: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.bool,
  ]),
  currentPage: React.PropTypes.number.isRequired,
  exposedComponents: React.PropTypes.object.isRequired,
  history: React.PropTypes.object.isRequired,
  limit: React.PropTypes.number.isRequired,
  loadCount: React.PropTypes.func.isRequired,
  loadingRecords: React.PropTypes.bool.isRequired,
  loadRecords: React.PropTypes.func.isRequired,
  location: React.PropTypes.object.isRequired,
  models: React.PropTypes.oneOfType([
    React.PropTypes.object,
    React.PropTypes.bool,
  ]),
  onLimitChange: React.PropTypes.func.isRequired,
  records: React.PropTypes.oneOfType([
    React.PropTypes.array,
    React.PropTypes.bool,
  ]),
  route: React.PropTypes.object.isRequired,
  routeParams: React.PropTypes.object.isRequired,
  schema: React.PropTypes.oneOfType([
    React.PropTypes.object,
    React.PropTypes.bool,
  ]),
  setCurrentModelName: React.PropTypes.func.isRequired,
  sort: React.PropTypes.string.isRequired,
};

function mapDispatchToProps(dispatch) {
  return {
    setCurrentModelName: modelName => dispatch(setCurrentModelName(modelName)),
    loadRecords: () => dispatch(loadRecords()),
    loadCount: () => dispatch(loadCount()),
    changePage: page => {
      dispatch(changePage(page));
      dispatch(loadRecords());
      dispatch(loadCount());
    },
    changeSort: sort => {
      dispatch(changeSort(sort));
      dispatch(loadRecords());
    },
    onLimitChange: e => {
      const newLimit = Number(e.target.value);
      dispatch(changeLimit(newLimit));
      dispatch(changePage(1));
      dispatch(loadRecords());
      e.target.blur();
    },
    dispatch,
  };
}

const mapStateToProps = createStructuredSelector({
  records: makeSelectRecords(),
  loadingRecords: makeSelectLoadingRecords(),
  count: makeSelectCount(),
  loadingCount: makeSelectLoadingCount(),
  models: makeSelectModels(),
  currentPage: makeSelectCurrentPage(),
  limit: makeSelectLimit(),
  sort: makeSelectSort(),
  currentModelName: makeSelectCurrentModelName(),
  currentModelNamePluralized: makeSelectCurrentModelNamePluralized(),
  schema: makeSelectSchema(),
});

export default connect(mapStateToProps, mapDispatchToProps)(List);
