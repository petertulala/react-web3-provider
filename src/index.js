import React from 'react';
import Web3 from 'web3';
import hoistNonReactStatics from 'hoist-non-react-statics';
import PropTypes from 'prop-types';


const Web3Context = React.createContext(null);

class Web3Provider extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      connection: {
        connected: false,
        isLoading: true,
        error: null,
      },
    };
  }

  componentDidMount() {
    this.tryProvider(window.web3, () => this.tryProvider(Web3.givenProvider, () => {
      // Web3 fallback -- always accept
      if (this.props.defaultProvider) {
        this.props.defaultProvider(this.setWeb3.bind(this));
      }

      // Breaking changes in MetaMask => see: https://medium.com/metamask/https-medium-com-metamask-breaking-change-injecting-web3-7722797916a8
      // Listen for provider injection
      window.addEventListener('message', ({ data }) => {
        if (data && data.type && data.type === 'ETHEREUM_PROVIDER_SUCCESS') {
          this.tryProvider(window.ethereum);
        }
      });

      // Request provider
      window.postMessage({ type: 'ETHEREUM_PROVIDER_REQUEST' }, '*');
    }));
  }

  setWeb3(web3) {
    this.setState({ web3: new Web3(web3) }, () => {
      this.state.web3.eth.net.isListening()
      .then(() => this.setState({
        connection: {
          isConnected: true,
          isLoading: false,
          error: null,
        },
      }))
      .catch((error) => this.setState({
        connection: {
          isConnected: false,
          isLoading: false,
          error,
        },
      }));
    });
  }

  tryProvider(web3, next = null) {
    if (web3) {
      const web3Wrapper = new Web3(web3);
      if (this.props.acceptProvider) this.props.acceptProvider(web3Wrapper, () => this.setWeb3(web3Wrapper), next);
      else this.setWeb3(web3Wrapper);
    } else if (next) next();
    else throw Error('Unexpected Web3 error.');
  }

  render() {
    const { web3, connection } = this.state;
    if (this.props.loading && connection.isLoading) {
      return this.props.loading;
    } else if (this.props.error && connection.error) {
      return this.props.error(connection.error);
    }

    return (
      <Web3Context.Provider
        value={{
          web3,
          connection: this.state.connection,
        }}
      >
        {this.props.children}
      </Web3Context.Provider>
    );
  }
}

Web3Provider.propTypes = {
  children: PropTypes.node.isRequired,
  defaultProvider: PropTypes.func,
  acceptProvider: PropTypes.func,
  loading: PropTypes.node,
  error: PropTypes.func,
};

export default Web3Provider;

export const withWeb3 = (WrappedComponent) => {
  class Web3Consumer extends React.Component { // eslint-disable-line
    render() {
      return (
        <Web3Context.Consumer>
          {(context) => (
            <WrappedComponent
              {...this.props}
              web3={context.web3}
              web3State={context.connection}
            />
          )}
        </Web3Context.Consumer>
      );
    }
  }

  if (WrappedComponent.defaultProps) {
    Web3Consumer.defaultProps = { ...WrappedComponent.defaultProps };
  }

  return hoistNonReactStatics(Web3Consumer, WrappedComponent);
};
