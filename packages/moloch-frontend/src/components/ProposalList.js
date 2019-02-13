import React from "react";
import { Divider, Segment, Grid, Progress, Button } from "semantic-ui-react";
import { Route, Switch, Link } from "react-router-dom";

import ProposalDetail from "./ProposalDetail";
import { connect } from "react-redux";
import { fetchProposals, fetchMemberDetail } from "../action/actions";
import { Query, withApollo } from "react-apollo";
import gql from "graphql-tag";
import { initMoloch } from "../web3";

const VOTING_PERIOD_LENGTH = 7;
const GRACE_PERIOD_LENGTH = 7;

const ProposalStatus = {
  InQueue: "InQueue",
  VotingPeriod: "VotingPeriod",
  GracePeriod: "GracePeriod",
  Aborted: "Aborted",
  Passed: "Passed",
  Failed: "Failed"
};

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

const ProgressBar = ({ yes, no }) => (
  <>
    <div style={{ position: "relative" }}>
      <Progress
        percent={yes + no}
        color="red"
        size="small"
        style={{
          position: "absolute",
          top: "0",
          width: "100%"
        }}
      />
      <Progress percent={yes} color="green" size="small" />
    </div>
    <Grid columns="equal">
      <Grid.Column floated="left">{typeof yes === "number" ? yes : 0}% Yes</Grid.Column>
      <Grid.Column floated="right" textAlign="right">
        {typeof no === "number" ? no : 0}% No
      </Grid.Column>
    </Grid>
  </>
);

const ProposalCard = ({ proposal }) => {
  let id = proposal.id;
  return (
    <Grid.Column mobile={16} tablet={8} computer={5}>
      <Link to={{ pathname: `/proposals/${id}` }} className="uncolored">
        <Segment className="blurred box">
          <p className="name">{proposal.title ? proposal.title : "N/A"}</p>
          <p className="subtext description">{proposal.description ? proposal.description : "N/A"}</p>
          <Grid columns="equal" className="value_shares">
            <Grid.Row>
              <Grid.Column textAlign="center">
                <p className="subtext">Shares</p>
                <p className="amount">{proposal.sharesRequested}</p>
              </Grid.Column>
              <Divider vertical />
              <Grid.Column textAlign="center">
                <p className="subtext">Total USD Value</p>
                <p className="amount">{formatter.format(0)}</p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
          <Grid columns="equal" className="deadlines">
            <Grid.Row>
              <Grid.Column textAlign="center">
                <Segment className="voting pill" textAlign="center">
                  <span className="subtext">Voting Ends: </span>
                  <span>1 day</span>
                </Segment>
              </Grid.Column>
              <Grid.Column textAlign="center">
                <Segment className="grace pill" textAlign="center">
                  <span className="subtext">Grace Period: </span>
                  <span>1 day</span>
                </Segment>
              </Grid.Column>
            </Grid.Row>
          </Grid>
          <ProgressBar yes={proposal.yesVotes} no={proposal.noVotes} />
        </Segment>
      </Link>
    </Grid.Column>
  );
};

const GET_PROPOSAL_LIST = gql`
  {
    proposals(orderBy: proposalIndex, orderDirection: desc) {
      id
      timestamp
      tokenTribute
      sharesRequested
      processed
      didPass
      aborted
      yesVotes
      noVotes
      proposalIndex
    }
  }
`;
class ProposalList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      proposals: []
    };

    this.fetchData(props);
  }

  async fetchData(props) {
    const { client } = props;
    const result = await client.query({
      query: GET_PROPOSAL_LIST
    });

    await this.determineProposalStatuses(result.data.proposals);
  }

  determineProposalStatuses = async proposals => {
    if (proposals.length === 0) {
      return;
    }

    const moloch = await initMoloch();
    const currentPeriod = await moloch.methods.getCurrentPeriod().call();
    console.log("currentPeriod: ", currentPeriod);

    const inGracePeriod = proposal =>
      currentPeriod > proposal.startingPeriod + VOTING_PERIOD_LENGTH &&
      currentPeriod < proposal.startingPeriod + VOTING_PERIOD_LENGTH + GRACE_PERIOD_LENGTH;

    const inVotingPeriod = proposal => currentPeriod > proposal.startingPeriod && currentPeriod < proposal.startingPeriod + VOTING_PERIOD_LENGTH;

    for (const proposal of proposals) {
      proposal.proposalIndex = parseInt(proposal.proposalIndex);
      const proposalFromChain = await moloch.methods.proposalQueue(proposal.proposalIndex).call();
      if (proposal.aborted) {
        proposal.status = ProposalStatus.Aborted;
      } else if (proposal.processed && proposal.didPass) {
        proposal.status = ProposalStatus.Passed;
      } else if (proposal.processed && !proposal.didPass) {
        proposal.status = ProposalStatus.Failed;
      } else if (proposal.proposalIndex !== 0 && !proposals[proposal.proposalIndex - 1].processed) {
        // if previous isnt processed, automatically in queue
        proposal.status = ProposalStatus.InQueue;
      } else if (inGracePeriod(proposalFromChain)) {
        proposal.status = ProposalStatus.GracePeriod;
      } else if (inVotingPeriod(proposalFromChain)) {
        proposal.status = ProposalStatus.VotingPeriod;
      } else {
        proposal.status = ProposalStatus.InQueue;
      }

      let details = {
        title: "",
        description: ""
      }
      try {
        details = JSON.parse(proposalFromChain.details)
      } catch (e) {
        console.log(`Could not parse details from proposalFromChain: ${proposalFromChain}`)
      }

      proposal.title = details.title
      proposal.description = details.description
    }

    console.log("proposals: ", proposals);
    this.setState({
      proposals
    });
    return;
  };

  render() {
    const { isActive } = this.props;
    const { proposals } = this.state;
    const gracePeriod = proposals.filter(p => p.status === ProposalStatus.GracePeriod)
    const votingPeriod = proposals.filter(p => p.status === ProposalStatus.VotingPeriod)
    const inQueue = proposals.filter(p => p.status === ProposalStatus.InQueue)
    const completed = proposals.filter(p => p.status === ProposalStatus.Aborted || p.status === ProposalStatus.Passed || p.status === ProposalStatus.Failed)
    return (
      <div id="proposal_list">
        <React.Fragment>
          <Grid columns={16} verticalAlign="middle">
            <Grid.Column mobile={16} tablet={8} computer={4} textAlign="right" floated="right" className="submit_button">
              <Link to={isActive ? "/membershipproposalsubmission" : "/proposals"} className="link">
                <Button size="large" color="red" disabled={!isActive}>
                  New Proposal
                </Button>
              </Link>
            </Grid.Column>
          </Grid>
          {/* Grace Period */}
          <Grid columns={16} verticalAlign="middle">
            <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
              <p className="subtext">
                {gracePeriod.length} Proposal{gracePeriod.length > 1 || gracePeriod.length === 0 ? "s" : ""}
              </p>
              <p className="title">In Grace Period</p>
            </Grid.Column>
          </Grid>
          <Grid columns={3}>
            {gracePeriod.map((p, index) => (
              <ProposalCard proposal={p} key={index} />
            ))}
          </Grid>
          {/* Voting Period */}
          <Grid columns={16} verticalAlign="middle">
            <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
              <p className="subtext">
                {votingPeriod.length} Proposal{votingPeriod.length > 1 || votingPeriod.length === 0 ? "s" : ""}
              </p>
              <p className="title">In Voting Period</p>
            </Grid.Column>
          </Grid>
          <Grid columns={3}>
            {votingPeriod.map((p, index) => (
              <ProposalCard proposal={p} key={index} />
            ))}
          </Grid>
          {/* In Queue */}
          <Grid columns={16} verticalAlign="middle">
            <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
              <p className="subtext">
                {inQueue.length} Proposal{inQueue.length > 1 || inQueue.length === 0 ? "s" : ""}
              </p>
              <p className="title">In Queue</p>
            </Grid.Column>
          </Grid>
          <Grid columns={3}>
            {inQueue.map((p, index) => (
              <ProposalCard proposal={p} key={index} />
            ))}
          </Grid>
          {/* Completed */}
          <Grid columns={16} verticalAlign="middle">
            <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
              <p className="subtext">
                {completed.length} Proposal{completed.length > 1 || completed.length === 0 ? "s" : ""}
              </p>
              <p className="title">Completed</p>
            </Grid.Column>
          </Grid>
          <Grid columns={3}>
            {completed.map((p, index) => (
              <ProposalCard proposal={p} key={index} />
            ))}
          </Grid>
        </React.Fragment>
      </div>
    );
  }
}
const ProposalListHOC = withApollo(ProposalList);

const GET_LOGGED_IN_USER = gql`
  query User($address: String!) {
    member(id: $address) {
      id
      shares
      isActive
    }
  }
`;
class ProposalListView extends React.Component {
  render() {
    let loggedUser = JSON.parse(localStorage.getItem("loggedUser"));

    return (
      <Query query={GET_LOGGED_IN_USER} variables={{ address: loggedUser.address }}>
        {({ loading, error, data }) => {
          if (loading) return "Loading...";
          if (error) throw new Error(`Error!: ${error}`);
          return (
            <Switch>
              <Route exact path="/proposals" render={() => <ProposalListHOC isActive={data.member.isActive} />} />
              <Route path="/proposals/:id" component={ProposalDetail} />
            </Switch>
          );
        }}
      </Query>
    );
  }
}

// This function is used to convert redux global state to desired props.
function mapStateToProps(state) {
  return {
    proposals: state.proposals.items ? state.proposals.items : {}
  };
}

// This function is used to provide callbacks to container component.
function mapDispatchToProps(dispatch) {
  return {
    fetchProposals: function(params) {
      dispatch(fetchProposals(params));
    },
    fetchMemberDetail: function(id) {
      return dispatch(fetchMemberDetail(id));
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ProposalListView);
