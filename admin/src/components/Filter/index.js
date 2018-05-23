/**
 *
 * Filter
 */


import React from 'react';
import moment from 'moment';
import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import { toString, upperFirst } from 'lodash';
import Flex from './Flex';
import Remove from './Remove';
import Separator from './Separator';


function Filter({ filter, index, onClick, schema }) {
  let value = filter.value;

  if (schema[filter.attr].type === 'date') {
    const format = filter.value
      .slice(0, -1)
      .split('T')[1]
      .split(':')
      .filter(x => x !== '00')
      .length > 0 ? 'MMMM Do YYYY, h:mm:ss a' : 'MMMM Do YYYY';

    value = moment(filter.value).format(format);
  }

  return (
    <Flex>
      <span>{upperFirst(filter.attr)}&nbsp;</span>
      <FormattedMessage id={`content-manager.components.FilterOptions.FILTER_TYPES.${filter.filter}`} />
      <span>&nbsp;{toString(value)}</span>
      <Separator />
      <Remove onClick={() => onClick(index)} />
    </Flex>
  );
}

Filter.defaultProps = {
  filter: {},
  index: 0,
  onClick: () => {},
  schema: {},
};

Filter.propTypes = {
  filter: PropTypes.object,
  index: PropTypes.number,
  onClick: PropTypes.func,
  schema: PropTypes.object,
};

export default Filter;
