import React, { Component } from 'react';
import { Card, Table, Grid, Header, Accordion, Popup, Segment, Icon, Image, Message } from 'semantic-ui-react';
import { isMobile } from 'react-device-detect';

import CONFIG from '../components/CONFIG';
import ItemDisplay from '../components/itemdisplay';
import CrewPopup from '../components/crewpopup';

import Worker from 'worker-loader!../workers/unifiedWorker';
import { ResponsiveLineCanvas } from '@nivo/line';
import themes from './nivo_themes';

const POSITION_POSTFIX = [
	'th',
	'st',
	'nd',
	'rd',
	'th',
	'th',
	'th',
	'th',
	'th',
	'th'
];

class CrewLineup {
	constructor(voyageConfig: object, roster: object[]) {
		this.voyageConfig = voyageConfig;
		this.roster = roster;

		this.usedCrew = [];
	}

	_voyageScore(skill: object) {
		return Math.floor(skill.core + (skill.range_min + skill.range_max)/2);
	}

	_renderFrozenPopup(crew: object) {
		return crew.immortal > 0 ? <Popup content={`${crew.immortal} frozen`} trigger={<Icon name="snowflake" />} /> : '';
	}

	_renderAMPopup(crew: object, trait: string) {
		return crew.traits.includes(trait.toLowerCase())
			? <Popup
					content='+25 AM'
					trigger={<img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_antimatter.png`} style={{ height: '1em' }} className='invertibleIcon' />}
				/>
			: '';
	}

	_renderSkillPopup(crew: object, slotSkill: string) {
		if (this.voyageConfig.state != 'pending')
			return '';

		const { roster, _voyageScore: voyScore } = this;
		const getTopSkill = crew => Object.entries(crew.skills)
																			.reduce((best, e) => voyScore(e[1]) > voyScore(best[1]) ? e : best)[0];
		const skillRankings = Object.keys(CONFIG.SKILLS).map(skill => ({
			skill,
			roster: roster.filter(c => Object.keys(c.skills).includes(skill))
										.filter(c => c.skills[skill].core > 0)
										.sort((c1, c2) => voyScore(c2.skills[skill]) - voyScore(c1.skills[skill]))
		}));
		const addPostfix = pos => pos > 3 && pos < 21 ? pos + 'th' : pos + POSITION_POSTFIX[pos%10];
		const topRank = roster ?
			skillRankings.filter(c => Object.keys(crew.skills).includes(c.skill))
									 .filter(c => !this.usedCrew.includes(c))
									 .reduce((best, ranking) => {
				const rank = ranking.roster
														.filter(c => Object.keys(c.base_skills).includes(slotSkill))
														.findIndex(c => crew.symbol === c.symbol) + 1;
				return rank < best.rank || (ranking.skill == slotSkill && rank <= best.rank)
					? {skill: ranking.skill, rank} : best;
			}, { rank: 1000 })
			: {skill: 'None, rank: 0'};
		const skillContent =  `Select ${topRank.rank == 1 ? 'top crew in' : addPostfix(topRank.rank) + ' crew from top'} in ${CONFIG.SKILLS[topRank.skill]}`;
		const skillIcon = <img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_${topRank.skill}.png`} style={{ height: '1em' }} />;

		this.usedCrew.push(crew);
		return (<Popup content={skillContent} trigger={skillIcon} />);
	}

	_renderPopups(crew: object, slot, trait, skill) {
		return [
			this._renderFrozenPopup(crew),
			this._renderSkillPopup(crew, skill, slot.skill),
			this._renderAMPopup(crew, trait)
		].map(child => <span style={{ paddingRight: '0.5em'}}>{child}</span>);
	}

	_renderSlot(crew: object[], slot: object, trait: string, skill: object) {
		throw('Function not implemented');
	}

	_renderSlots() {
		return Object.values(CONFIG.VOYAGE_CREW_SLOTS).map((entry, idx) => {
			const slot = Object.values(this.voyageConfig.crew_slots).find(slot => slot.symbol == entry);
			const { crew, name, trait, skill } = slot;
			if (!crew.imageUrlPortrait)
				crew.imageUrlPortrait =
					`${crew.portrait.file.substring(1).replaceAll('/', '_')}.png`;

			return this._renderSlot(crew, slot, trait, skill);
		});
	}

	render() {
		throw('Function not implemented');
	}
}

const crewLinupFormats = [
	class extends CrewLineup {
		render() { return (<ul>{this._renderSlots()}</ul>) }
		_renderSlot(crew: object, slot: object, trait: string, skill: object) {
			return (<li key={slot.name}>
				{slot.name}
				{'  :  '}
				<CrewPopup crew={crew} useBase={false} />
				{'\t'}
				{this._renderPopups(crew, slot, trait, skill)}
			</li>);
		}
	},
	class extends CrewLineup {
		render() { return <table style={{ marginTop: '1em' }}><tbody>{this._renderSlots()}</tbody></table> }
		_renderSlot(crew: object, slot: object, trait: string, skill: object) {
			return <tr key={slot.name}>
				<td>
					{slot.name}
				</td>
				<td>
					<CrewPopup crew={crew} useBase={false} />
				</td>
				<td style={{ textAlign: 'justify', verticalAlign: 'middle' }}>
					{this._renderPopups(crew, slot, trait, skill)}
				</td>
			</tr>;
		}
	},
	class extends CrewLineup {
		render() { return <table style={{ marginTop: '1em' }}><tbody>{this._renderSlots()}</tbody></table> }
		_renderSlot(crew: object, slot: object, trait: string, skill: object) {
			return <tr key={slot.name}>
					<td>
						{slot.name}
					</td>
					<td>
						<ItemDisplay
							src={`${process.env.GATSBY_ASSETS_URL}${crew.imageUrlPortrait}`}
							size={32}
							maxRarity={crew.max_rarity}
							rarity={crew.rarity}
						/>
					</td>
					<td>
						<CrewPopup crew={crew} useBase={false} />
					</td>
					<td style={{textAlign: 'center', verticalAlign: 'middle' }}>
						{this._renderFrozenPopup(crew)}
						{this._renderAMPopup(crew, trait)}
						{this._renderSkillPopup(crew, slot.skill)}
					</td>
				</tr>;
			}
		},
		class extends CrewLineup {
			render() {
				return (
					<div style={{ marginTop: '1em' }}>
						<Card.Group itemsPerRow={2}>
							{this._renderSlots()}
						</Card.Group>
					</div>
				);
			}
			_renderSlot(crew: object, slot: object, trait: string, skill: object) {
				function renderCrewSkills(crew: any): JSX.Element {
					let skills = [];
					for (let skillName in CONFIG.SKILLS) {
						let skill = crew.skills[skillName];
						if (skill && skill.core && skill.core > 0) {
							skills.push({
								'skill': skillName,
								score: Math.floor(skill.core + (skill.range_min + skill.range_max) / 2)
							});
						}
					}
					skills.sort((a, b) => b.score - a.score);
					return (
						<React.Fragment>
							{skills.map(skill => (
								<span key={skill.skill} style={{ marginRight: '1em' }}>
									<img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_${skill.skill}.png`} style={{ height: '1em' }} /> {skill.score}
								</span>
							))}
						</React.Fragment>
					);
				}

				return <Card key={slot.name}>
					<Card.Content>
						<div style={{ float: 'left' }}>
							<ItemDisplay
								src={`${process.env.GATSBY_ASSETS_URL}${crew.imageUrlPortrait}`}
								size={48}
								maxRarity={crew.max_rarity}
								rarity={crew.rarity}
							/>
						</div>
						<Card.Header>
							<img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_${skill}.png`} style={{ height: '1.5em', float: 'right' }} />
							<CrewPopup crew={crew} useBase={false} />
						</Card.Header>
						<div>
							{name}
							{this._renderFrozenPopup(crew)}
							{this._renderAMPopup(crew, trait)}
							<br />
							{renderCrewSkills(crew)}
						</div>
					</Card.Content>

				</Card>
		}
	}
];

type VoyageStatsProps = {
	voyageData: any;
	numSims?: number;
	ships: [];
	showPanels: [];
	estimate?: any;
	roster?: any[];
	playerItems?: any[];
};

type VoyageStatsState = {
	estimate: any;
	activePanels: [];
	currentAm: number;
	currentDuration: number;
	crewView: number;
};

export class VoyageStats extends Component<VoyageStatsProps, VoyageStatsState> {
	static defaultProps = {
		roster: [],
	};

	constructor(props) {
		super(props);
		const { estimate, numSims, showPanels, ships, voyageData } = this.props;

		this.state = {
			estimate: estimate,
			activePanels: showPanels ? showPanels : [],
			voyageBugDetected: 	Math.floor(voyageData.voyage_duration/7200) > Math.floor(voyageData.log_index/360),
			crewView: 0
		};

		if (!voyageData)
			return;

		this.ship = ships.length == 1 ? ships[0].ship : ships.find(s => s.id == voyageData.ship_id);

		if (!estimate) {
			const score = agg => Math.floor(agg.core + (agg.range_min+agg.range_max)/2);
			const duration = voyageData.voyage_duration ?? 0;
			const correctedDuration = this.state.voyageBugDetected ? duration : duration - duration%7200;

			this.config = {
				others: [],
				numSims: numSims ?? 5000,
				startAm: voyageData.max_hp,
				currentAm: voyageData.hp ?? voyageData.max_hp,
				elapsedSeconds: correctedDuration,
			};

			for (let agg of Object.values(voyageData.skill_aggregates)) {
				let skillOdds = 0.1;

				if (agg.skill == voyageData.skills.primary_skill)
					this.config.ps = agg;
				else if (agg.skill == voyageData.skills.secondary_skill)
					this.config.ss = agg;
				else
					this.config.others.push(agg);

				this.config.variance += ((agg.range_max-agg.range_min)/(agg.core + agg.range_max))*skillOdds;
			}

			this.worker = new Worker();
			this.worker.addEventListener('message', message => this.setState({ estimate: message.data.result }));
			this.worker.postMessage({ worker: 'chewable', config: this.config });
		}
	}

	componentWillUnmount() {
		if (this.worker)
			this.worker.terminate();
	}

	_formatTime(time: number) {
		let hours = Math.floor(time);
		let minutes = Math.floor((time-hours)*60);

		return hours+"h " +minutes+"m";
	}

	_renderChart(needsRevive: boolean) {
		const estimate = this.props.estimate ?? this.state.estimate;

		const names = needsRevive ? ['First refill', 'Second refill']
															: [ 'No refills', 'One refill', 'Two refills'];

		const rawData = needsRevive ? estimate.refills : estimate.refills.slice(0, 2);
		// Convert bins to percentages
		const data = estimate.refills.map((refill, index) => {
			var bins = {};
			const binSize = 1/30;

			for (var result of refill.all.sort()) {
				const bin = Math.floor(result/binSize)*binSize+binSize/2;

			  try{
					++bins[bin].count;
			  }
			  catch {
					bins[bin] = {result: bin, count: 1};
			  }
			}

			delete bins[NaN];
			var refillBins = Object.values(bins);

			const total = refillBins.map(value => value.count)
															.reduce((acc, value) => acc + value, 0);
			var aggregate = total;
			const cumValues = value => {
				aggregate -= value.count;
				return {x: value.result, y: (aggregate/total)*100};
			};
			const ongoing = value => { return {x: value.result, y: value.count/total}};

			const percentages = refillBins
																.sort((bin1, bin2) => bin1.result - bin2.result)
																.map(cumValues);

			return {
				id: names[index],
				data: percentages
			};
		});

		return (
			<div style={{height : 200}}>
				<ResponsiveLineCanvas
					data={data}
					xScale= {{type: 'linear', min: data[0].data[0].x}}
					yScale={{type: 'linear', max: 100 }}
					theme={themes.dark}
					axisBottom={{legend : 'Voyage length (hours)', legendOffset: 30, legendPosition: 'middle'}}
					axisLeft={{legend : 'Chance (%)', legendOffset: -36, legendPosition: 'middle'}}
					margin={{ top: 50, right: 130, bottom: 50, left: 100 }}
					enablePoints= {true}
					pointSize={0}
					useMesh={true}
					crosshairType='none'
					tooltip={input => {
						let data = input.point.data;
						return `${input.point.serieId}: ${data.y.toFixed(2)}% chance of reaching ${this._formatTime(data.x)}`;
					}}
					legends={[
						{
							dataFrom: 'keys',
							anchor: 'bottom-right',
							direction: 'column',
							justify: false,
							translateX: 120,
							translateY: 0,
							itemsSpacing: 2,
							itemWidth: 100,
							itemHeight: 20,
							symbolSize: 20,
							effects: [
								{
									on: 'hover',
									style: {
										itemOpacity: 1,
									},
								},
							],
						},
					]}
				/>
			</div>
		);
	}

	_renderCrew() {
		const { voyageData, roster } = this.props;
		const ship  = this.ship;
		const voyScore = skill => Math.floor(skill.core + (skill.range_min + skill.range_max)/2);

		return (
			<div>
			  {ship && (<span style={{paddingRight: '0.5em'}}>Ship : <b>{ship.name}</b></span>)}
				<Icon link name='eye' onClick={() => this.setState({crewView: (this.state.crewView+1)%4})} />
				<Grid columns={isMobile ? 1 : 2}>
					<Grid.Column>
						{new crewLinupFormats[this.state.crewView](voyageData, roster).render()}
					</Grid.Column>
					<Grid.Column verticalAlign="middle">
						<ul>
							<li>
								Antimatter
								{' : '}
								<b>{voyageData.max_hp}</b>
							</li>
						</ul>
						<ul>
							{Object.keys(CONFIG.SKILLS).map((entry, idx) => {
								const agg = voyageData.skill_aggregates[entry];

								if (typeof(agg) === 'number') {
									return (<li key={idx}>{`${CONFIG.SKILLS[entry]} : ${Math.round(agg)}`}</li>);
								} else {
									const score = voyScore(agg);

									return (
										<li key={idx}>
											{CONFIG.SKILLS[entry]}
											{' : '}
											<Popup wide trigger={<span style={{ cursor: 'help', fontWeight: 'bolder' }}>{score}</span>}>
												<Popup.Content>
													{agg.core + ' +(' + agg.range_min + '-' + agg.range_max + ')'}
												</Popup.Content>
											</Popup>
										</li>
									);
								}
							})}
						</ul>
					</Grid.Column>
				</Grid>
			</div>
		);
	}

	_renderEstimateTitle(needsRevive: boolean = false) {
		const estimate  = this.props.estimate ?? this.state.estimate;

		return needsRevive || !estimate
			?	'Estimate'
			: 'Estimate: ' + this._formatTime(estimate['refills'][0].result);
	}

	_renderEstimate(needsRevive: boolean = false) {
		const estimate  = this.props.estimate ?? this.state.estimate;

		if (!estimate)
			return (<div>Calculating estimate. Please wait...</div>);

		const renderEst = (label, refills) => {
			if (refills >= estimate['refills'].length) return (<></>);
			const est = estimate['refills'][refills];
			return (
				<tr>
					<td>{label}: {this._formatTime(est.result)}</td>
					{!isMobile && <td>90%: {this._formatTime(est.safeResult)}</td>}
					<td>99%: {this._formatTime(est.saferResult)}</td>
					<td>Chance of {est.lastDil} hour dilemma: {Math.floor(est.dilChance)}%</td>
					<td>{est.refillCostResult == 0 || 'Costing ' + est.refillCostResult + ' dilithium'}</td>
				</tr>
			);
		};

		if (estimate.deterministic) {
			let extendTime = estimate['refills'][1].result - estimate['refills'][0].result;

			return (
				<div>
					The voyage will end at {this._formatTime(estimate['refills'][0].result)}.
					Subsequent refills will extend it by {this._formatTime(extendTime)}.
					For a 20 hour voyage you need {estimate['20hrrefills']} refills at a cost of {estimate['20hrdil']} dilithium.
				</div>
			);
		} else {
			let refill = 0;

			return (
				<div>
					<Table><tbody>
						{!needsRevive && renderEst("Estimate", refill++)}
						{renderEst("1 Refill", refill++)}
						{renderEst("2 Refills", refill++)}
					</tbody></Table>
					<p>The 20 hour voyage needs {estimate['20hrrefills']} refills at a cost of {estimate['20hrdil']} dilithium.</p>
					{estimate.final && this._renderChart()}
					<small>Powered by Chewable C++</small>
				</div>
			);
		}
	}

	_renderRewardsTitle(rewards) {
		const { voyageData } = this.props;
		const crewGained = rewards.filter(r => r.type === 1);
		const bestRarity = crewGained.length == 0 ? 0 : crewGained.map(c => c.rarity).reduce((acc, r) => Math.max(acc, r));
		const bestCrewCount = crewGained
			.filter(c => c.rarity == bestRarity)
			.map(c => c.quantity)
			.reduce((acc, c) => acc + c, 0);
		const chronReward = rewards.filter(r => r.symbol === 'energy');
		const chrons = chronReward.length == 0 ? 0 : chronReward[0].quantity;
		const honorReward = rewards.filter(r => r.symbol === 'honor');
		const honor = honorReward.length == 0 ? 0 : honorReward[0].quantity;
		return (
			<span>
				{`Rewards: ${bestCrewCount} ${bestRarity}* `}&nbsp;
				{` ${chrons} `}
				<img
					src={`${process.env.GATSBY_ASSETS_URL}atlas/energy_icon.png`}
					style={{width : '16px', verticalAlign: 'text-bottom'}}
				/>&nbsp;&nbsp;
				{` ${honor} `}
				<img
					src={`${process.env.GATSBY_ASSETS_URL}currency_honor_currency_0.png`}
					style={{width : '16px', verticalAlign: 'text-bottom'}}
				/>
			</span>
		)
	}

	_renderRewards(rewards) {
		const { playerItems,roster } = this.props;

		rewards = rewards.sort((a, b) => {
			if (a.type == b.type && a.item_type === b.item_type && a.rarity == b.rarity)
				return a.full_name.localeCompare(b.full_name);
			else if (a.type == b.type && a.item_type === b.item_type)
				return b.rarity - a.rarity;
			else if (a.type == b.type)
				return b.item_type - a.item_type;
			else if (a.type == 2)
				return 1;
			else if (b.type == 2)
				return -1;
			return a.type - b.type;
		});
		const hideRarity = entry => entry.type == 3;
		const rarity = entry => entry.type == 1 ? 1 : entry.rarity;
		const assetURL = file => {
			let url = file === 'energy_icon'
				? 'atlas/energy_icon.png'
				: `${file.substring(1).replaceAll('/', '_')}`;

			if (!url.match(/\.png$/))
				url += '.png'
			return `${process.env.GATSBY_ASSETS_URL}${url}`;
		};

		const itemsOwned = item => {
			const pItem = playerItems.find(i => i.symbol == item.symbol);
			return `(Have ${pItem ? pItem.quantity > 1000 ? `${Math.floor(pItem.quantity/1000)}k+` : pItem.quantity : 0})`;
		};
		const ownedFuncs = [
			item => '',
			item => {
				const owned = roster.filter(c => c.symbol == item.symbol);

				for (const c of owned)
					if (c.rarity < c.max_rarity)
						return '(Fusable)';

				return  owned.length > 0 ? '(Duplicate)' : '(Unowned)';
			},
			itemsOwned,
			item => '',
		];

		return (
			<div>
				<Grid columns={isMobile ? 2 : 5} centered padded>
					{rewards.map((entry, idx) => (
						<Grid.Column key={idx}>
							<Header
								style={{ display: 'flex' }}
								icon={
									<ItemDisplay
										src={assetURL(entry.icon.file)}
										size={48}
										rarity={rarity(entry)}
										maxRarity={entry.rarity}
										hideRarity={hideRarity(entry)}
									/>
								}
								content={entry.name}
								subheader={`Got ${entry.quantity} ${ownedFuncs[entry.type](entry)}`}
							/>
						</Grid.Column>
					))}
				</Grid>
			</div>
		);
	}

	/* Not yet in use
	_renderReminder() {
		return (
			<div>
				<p>Remind me :-</p>
				<Form.Field
					control={Checkbox}
					label={<label>At the next dilemma.</label>}
					checked={this.state.dilemmaAlarm}
					onChange={(e, { checked }) => this.setState({ dilemmaAlarm: checked}) }
				/>
				<Form.Field
					control={Checkbox}
					label={<label>When the probably of voyage still running reaches {oddsControl}.</label>}
					checked={this.state.failureAlarm}
					onChange={(e, {checked}) => this.setState({failureAlarm : checked}) }
				/>
			</div>
		);
	}
	*/

	render() {
		const { voyageData } = this.props;

		if (!voyageData)
			return (<Dimmer active>
        <Loader>Calculating...</Loader>
      </Dimmer>);

		const { activePanels } = this.state;
		const voyState = voyageData.state;
		const rewards = voyState !== 'pending' ? voyageData.pending_rewards.loot : [];

		// Adds/Removes panels from the active list
		const flipItem = (items, item) => items.includes(item)
			? items.filter(i => i != item)
			: items.concat(item);
		const handleClick = (e, {index}) =>
			this.setState({
				activePanels: flipItem(activePanels, index)
			});
		const accordionPanel = (title, content, key, ctitle = false) => {
			const collapsedTitle = ctitle ? ctitle : title;
			const isActive = activePanels.includes(key);
			return (
				<Accordion.Panel
					active={isActive}
					index={key}
					onTitleClick={handleClick}
					title={isActive ? {icon: 'caret down', content: collapsedTitle} : {icon: 'caret right', content: collapsedTitle}}
					content={{content: <Segment>{content}</Segment>}}/>
			);
		};

		if (voyState !== 'pending') {
			const msgTypes = {
				started: ' has been running for ',
				failed: ' failed at ',
				recalled: ' ran for ',
				completed: ' ran for '
			};
			const voyagePriSec = Object.values(voyageData.skills)
																 .map(s1 => CONFIG.SKILLS_SHORT.filter(s2 => s2.name === s1)[0].short)
																 .join('/');
			const timeDiscrepency = Math.floor(voyageData.voyage_duration/7200) - Math.floor(voyageData.log_index/360);
			const voyageDuration = this._formatTime(voyageData.state == 'started' ? voyageData.voyage_duration/3600 : voyageData.log_index/180);

			return (
				<div>
					{(voyageData.state === 'started' && timeDiscrepency > 0) &&
						<Message warning>
							WARNING!!! A potential problem with the reported voyage duration has been detected.
							We have attemped to correct this but estimate may be inaccurate.
							Open the game then return to Datacore with a fresh copy of your player file to guarrentee an accurate estimate.
						</Message>
					}
					<Message>Your voyage ({voyagePriSec}){msgTypes[voyState] + voyageDuration}.</Message>
					<Accordion fluid exclusive={false}>
					{
						voyState !== 'recalled' && voyState !== 'completed' &&
						accordionPanel('Voyage estimate', this._renderEstimate(voyState === 'failed'), 'estimate', this._renderEstimateTitle())
					}
					{ accordionPanel('Voyage lineup', this._renderCrew(), 'crew') }
					{
						accordionPanel('Rewards', this._renderRewards(rewards), 'rewards', this._renderRewardsTitle(rewards))
					}
					</Accordion>
				</div>
			);
		} else {
			return (
				<div>
					<Accordion fluid exclusive={false}>
						{ accordionPanel('Voyage estimate', this._renderEstimate(false), 'estimate', this._renderEstimateTitle()) }
						{ accordionPanel('Voyage lineup', this._renderCrew(), 'crew') }
					</Accordion>
				</div>
			);
		}
	}

}

export default VoyageStats;
