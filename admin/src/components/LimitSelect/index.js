/**
 *
 * LimitSelect
 *
 */

import React from 'react';
import _ from 'lodash';
import { FormattedMessage } from 'react-intl';

import { define } from 'i18n';

import messages from './messages.json';
import styles from './styles.scss';

define(messages);

class LimitSelect extends React.Component {
  componentWillMount() {
    const id = _.uniqueId();
    this.setState({ id });
  }

  shouldComponentUpdate() {
    return false;
  }

  /**
   * Return the list of default values to populate the select options
   *
   * @returns {number[]}
   */
  getOptionsValues() {
    return [10, 20, 50, 100];
  }

  render() {
    // Generate options
    const options = this.getOptionsValues().map(optionValue => (
      <option value={optionValue} key={optionValue}>{optionValue}</option>
    ));

    // Get id in order to link the `label` and the `select` elements
    const id = this.state.id;

    return (
      <form className="form-inline">
        <div className="form-group">
          <label className={styles.label} htmlFor={id}>
            <FormattedMessage {...messages.itemsPerPage} />:</label>
          <div className={styles.selectWrapper}>
            <select
              onChange={this.props.onLimitChange}
              className={`form-control ${styles.select}`}
              id={id}
            >
              {options}
            </select>
          </div>
        </div>
      </form>
    );
  }
}

LimitSelect.propTypes = {
  onLimitChange: React.PropTypes.func.isRequired,
};

export default LimitSelect;
