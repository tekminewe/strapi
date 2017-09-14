/*
 * Home
 */

import React from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import { FormattedMessage } from 'react-intl';

import PluginHeader from 'components/PluginHeader';
import Container from 'components/Container';

import styles from './styles.scss';

export class Home extends React.Component {
  render() {
    return (
      <div>
        <div className={`container-fluid ${styles.containerFluid}`}>
          <PluginHeader
            title="Content Manager"
            description={{
              id: 'content-manager.containers.Home.pluginHeaderDescription',
            }}
          />
          <Container>
            <p>
              <FormattedMessage id="content-manager.containers.Home.introduction" />
            </p>
          </Container>
        </div>
      </div>
    );
  }
}

Home.propTypes = {
  // exposedComponents: React.PropTypes.object.isRequired,
};

export function mapDispatchToProps() {
  return {};
}

const mapStateToProps = createStructuredSelector({});

// Wrap the component to inject dispatch and state into it
export default connect(mapStateToProps, mapDispatchToProps)(Home);
