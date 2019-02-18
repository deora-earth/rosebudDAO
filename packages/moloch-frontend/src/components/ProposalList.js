import React from 'react';
import { Divider, Segment, Grid, Progress, Button } from 'semantic-ui-react';
import { Route, Switch, Link } from "react-router-dom";
import moment from 'moment';

import ProposalDetail from "./ProposalDetail";
import { connect } from 'react-redux';
import { fetchProposals, fetchMemberDetail } from '../action/actions';

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});

const ProgressBar = ({ yes, no }) => (
  <>
    <div style={{ "position": "relative" }}>
      <Progress percent={yes + no} color="red" size="small" style={{
        "position": "absolute",
        "top": "0",
        "width": "100%"
      }} />
      <Progress percent={yes} color="green" size="small" />
    </div>
    <Grid columns="equal">
      <Grid.Column floated="left">
      {(typeof (yes) === 'number' && yes >= 0) ? yes : 0}% Yes
      </Grid.Column>
      <Grid.Column floated="right" textAlign="right">
      {(typeof (no) === 'number' && no >= 0) ? no : 0}% No
      </Grid.Column>
    </Grid>
  </>
);

const ProposalCard = ({ proposal }) => {
  let type = proposal.address ? 'member' : 'project';
  let id = proposal.shares ? proposal.address : proposal.id;
  let gracePeriod = proposal.status === 'votingperiod' ? proposal.gracePeriod : 0;
  let end = proposal.status === 'votingperiod' ? proposal.end : 0;
  return (
    <Grid.Column mobile={16} tablet={8} computer={5}>
      <Link to={{ pathname: `/proposals/${id}`, state: { type: type, status: proposal.status, gracePeriod: gracePeriod, end: end } }} className="uncolored">
        <Segment className="blurred box">
          <p className="name">{proposal.title}</p>
          <p className="subtext description">{proposal.description}</p>
          <Grid columns="equal" className="value_shares">
            <Grid.Row>
              {proposal.shares ?
                <Grid.Column textAlign="center">
                  <p className="subtext">Shares</p>
                  <p className="amount">{proposal.shares}</p>
                </Grid.Column> : null}
              {proposal.shares ? <Divider vertical /> : null}
              <Grid.Column textAlign="center">
                <p className="subtext">Total USD Value</p>
                <p className="amount">{formatter.format(proposal.tribute ? proposal.tribute : 0)}</p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
          <Grid columns="equal" className="deadlines">
            <Grid.Row>
              <Grid.Column textAlign="center">
                <Segment className="voting pill" textAlign="center">
                  <span className="subtext">Voting Ends: </span>
                  <span>{end} day{end > 0 ? 's' : null}</span>
                </Segment>
              </Grid.Column>
              <Grid.Column textAlign="center">
                <Segment className="grace pill" textAlign="center">
                  <span className="subtext">Grace Period: </span>
                  <span>{gracePeriod} day{gracePeriod > 0 ? 's' : null}</span>
                </Segment>
              </Grid.Column>
            </Grid.Row>
          </Grid>
          <ProgressBar yes={proposal.votedYes} no={proposal.votedNo} />
        </Segment>
      </Link>
    </Grid.Column>
  )
};


const ProposalList = (props) => {
  let hasItem = false;
  let showBtnKey = null;
  // eslint-disable-next-line array-callback-return
  Object.keys(props.proposals).map((key, idx) => {
    if(props.proposals[key].length > 0){
      if(!showBtnKey){
        showBtnKey = key;
      }
      hasItem = true;
      return true;
    }
  });
  return (
    <div id="proposal_list">
      {hasItem > 0 ? null : <>
        <Grid columns={16} verticalAlign="middle">
          <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
            <>No proposals to show.</>
          </Grid.Column>
          <Grid.Column mobile={16} tablet={8} computer={4} textAlign="right" floated="right" className="submit_button">
            <Link to={props.userShare && (props.memberStatus === 'passed' || props.memberStatus === 'founder') ? '/membershipproposalsubmission' : '/proposals'} className="link">
              <Button size='large' color='red' disabled={props.userShare && (props.memberStatus === 'passed' || props.memberStatus === 'founder') ? false : true}>New Proposal</Button>
            </Link>
          </Grid.Column>
        </Grid></>}
      {props.proposals['votingperiod'] ?
        <React.Fragment >
          {props.proposals['votingperiod'].length > 0 ?
            <>
              <Grid columns={16} verticalAlign="middle">
                <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
                  <p className="subtext">{props.proposals['votingperiod'].length} Proposal{props.proposals['votingperiod'].length > 1 ? 's' : ''}</p>
                  <p className="title">Voting Period</p>
                </Grid.Column>
                <Grid.Column mobile={16} tablet={8} computer={4} textAlign="right" floated="right" className="submit_button">
                  <Link to={props.userShare && (props.memberStatus === 'passed' || props.memberStatus === 'founder') ? '/membershipproposalsubmission' : '/proposals'} className="link">
                    <Button size='large' color='red' disabled={props.userShare && (props.memberStatus === 'passed' || props.memberStatus === 'founder') ? false : true}>New Proposal</Button>
                  </Link>
                </Grid.Column>
              </Grid>
              <Grid columns={3} >
                {props.proposals['votingperiod'].map((p, index) => <ProposalCard proposal={p} key={index} />)}
              </Grid> </> : null}
        </React.Fragment> : null}
      {
        Object.keys(props.proposals).map((key, idx) =>
          <React.Fragment key={idx}>
            {props.proposals[key].length > 0 && key !== 'votingperiod' ?
              <>
                <Grid columns={16} verticalAlign="middle">
                  <Grid.Column mobile={16} tablet={8} computer={8} textAlign="left">
                    <p className="subtext">{props.proposals[key].length} Proposal{props.proposals[key].length > 1 ? 's' : ''}</p>
                    <p className="title">{ key === 'inqueue' ? 'In Queue' : (key === 'graceperiod' ? 'Grace Period' : (key.charAt(0).toUpperCase() + key.slice(1)).match(/[A-Z][a-z]+|[0-9]+/g).join(" ") ) }</p>
                  </Grid.Column>
                  {showBtnKey === key && props.proposals['votingperiod'].length === 0 ?
                    <Grid.Column mobile={16} tablet={8} computer={4} textAlign="right" floated="right" className="submit_button">
                      <Link to={props.userShare && (props.memberStatus === 'passed' || props.memberStatus === 'founder') ? '/membershipproposalsubmission' : '/proposals'} className="link">
                        <Button size='large' color='red' disabled={props.userShare && (props.memberStatus === 'passed' || props.memberStatus === 'founder') ? false : true}>New Proposal</Button>
                      </Link>
                    </Grid.Column> 
                    : null}
                </Grid>
                <Grid columns={3} >
                  {props.proposals[key].map((p, index) => <ProposalCard proposal={p} key={index} />)}
              </Grid> </>  : null}
          </React.Fragment>
        )}
    </div>
  )
};

class ProposalListView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      totalShares: parseInt(localStorage.getItem('totalShares')),
      loggedUser: JSON.parse(localStorage.getItem('loggedUser')).address,
      userShare: 0,
      memberStatus: ''
    }

    this.calculateVote = this.calculateVote.bind(this);
  }

  componentDidMount() {
    let proposalParams = {
      currentDate: moment(new Date()).format('YYYY-MM-DD')
    }
    this.props.fetchProposals(proposalParams)
    this.props.fetchMemberDetail(this.state.loggedUser)
      .then((responseJson) => {
        this.setState({
          userShare: (responseJson.items.member.shares) ? responseJson.items.member.shares : 0,
          totalShares: responseJson.items.totalShares,
          memberStatus: (responseJson.items.member.status) ? responseJson.items.member.status : '',
        });
      })
  }

  componentWillReceiveProps(props) {
    // eslint-disable-next-line array-callback-return
    Object.keys(props.proposals).map((key, idx) => {
      // eslint-disable-next-line array-callback-return
      props.proposals[key].map((p) => {
        if(p.voters){
          let calculatedVotes = this.calculateVote(p.voters);
          p.votedYes = calculatedVotes.votedYes;
          p.votedNo = calculatedVotes.votedNo;
        } else {
          p.votedYes = 0;
          p.votedNo = 0
        }
      })
    })
  }

  calculateVote(voters) {
    // calculate votes
    let totalNumberVotedYes = 0;
    let totalNumberVotedNo = 0;
    if (voters) {
      // eslint-disable-next-line array-callback-return
      voters.map((voter, idx) => {
        if (voter.shares) {
          switch (voter.vote) {
            case 'yes':
              totalNumberVotedYes += voter.shares;
              break;
            case 'no':
              totalNumberVotedNo += voter.shares;
              break;
            default: break;
          }
        }
      });
    }
    let percentYes = Math.ceil((totalNumberVotedYes / this.state.totalShares) * 100);
    let percentNo =  Math.ceil((totalNumberVotedNo / this.state.totalShares) * 100);

    return {
      votedYes: percentYes,
      votedNo: percentNo
    }
  }
  render() {
    return (
      <Switch>
        <Route exact path="/proposals" render={(props) => <ProposalList proposals={this.props.proposals} userShare={this.state.userShare} memberStatus={this.state.memberStatus} />} />
        <Route path="/proposals/:id" component={ProposalDetail} />
      </Switch>
    )
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
    fetchProposals: function (params) {
      dispatch(fetchProposals(params));
    },
    fetchMemberDetail: function (id) {
      return dispatch(fetchMemberDetail(id));
    },
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(ProposalListView);
