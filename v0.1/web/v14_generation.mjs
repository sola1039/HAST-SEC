import {basePolicy} from '../motion/base_policy.mjs';
import {conditionalBase} from './v14_base.mjs';
import {extendedPolicy} from './v15_policy.mjs';
import {candidatePanel} from './v15_panel.mjs';
export async function generation(){
 const conditional=await conditionalBase('/v15-data/');
 return {generation:'v15',bootstrap:'/v15-api/bootstrap',behavior:basePolicy(conditional),policy:extendedPolicy,decorate:candidatePanel};
}
