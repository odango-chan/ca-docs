export type CapabilityMeta = { title: string; description: string; subject: string; category: string; };

export const factMetaEn: Record<string, CapabilityMeta> = {
  UE_REGISTRATION:{title:'UE registration',description:'Reads authoritative registration-management state for a SUPI.',subject:'UE',category:'Registration'},
  UE_REGISTRATION_CONTEXT:{title:'Registration context',description:'Reads registration-context state and consistency.',subject:'UE',category:'Registration'},
  PDU_SESSION:{title:'PDU session',description:'Reads session lifecycle, DNN, S-NSSAI, QoS and user-plane state.',subject:'PDU_SESSION',category:'Session'},
  USER_PLANE_CONNECTIVITY:{title:'User-plane connectivity',description:'Reads whether the modeled user plane is currently available.',subject:'PDU_SESSION',category:'User plane'},
  PFCP_RESOURCE:{title:'PFCP resource',description:'Reads modeled PFCP resources and their lifecycle state.',subject:'PDU_SESSION',category:'PFCP'},
  TRANSFER_PARTICIPANTS:{title:'Transfer participants',description:'Resolves whether transfer participants are ready and exposes their endpoints.',subject:'TRANSFER_PARTICIPANTS',category:'Transfer'},
  VIRTUAL_GROUP:{title:'Virtual group',description:'Reads virtual-group state, identity and assigned members.',subject:'TRANSFER / VIRTUAL_GROUP',category:'Transfer'},
  TRANSFER_QOS:{title:'Transfer QoS',description:'Reads the transfer-level QoS boost state.',subject:'TRANSFER',category:'Transfer'},
};

export const factMetaZh: Record<string, CapabilityMeta> = {
  UE_REGISTRATION:{title:'UE 注册状态',description:'读取指定 SUPI 的权威注册管理状态。',subject:'UE',category:'注册'},
  UE_REGISTRATION_CONTEXT:{title:'注册上下文',description:'读取 UE 注册上下文状态及其一致性。',subject:'UE',category:'注册'},
  PDU_SESSION:{title:'PDU 会话',description:'读取会话生命周期、DNN、S-NSSAI、QoS 与用户面状态。',subject:'PDU_SESSION',category:'会话'},
  USER_PLANE_CONNECTIVITY:{title:'用户面连通性',description:'读取模拟用户面当前是否可用。',subject:'PDU_SESSION',category:'用户面'},
  PFCP_RESOURCE:{title:'PFCP 资源',description:'读取模拟 PFCP 资源及其生命周期状态。',subject:'PDU_SESSION',category:'PFCP'},
  TRANSFER_PARTICIPANTS:{title:'传输参与方',description:'读取传输参与方是否就绪，并暴露对应端点信息。',subject:'TRANSFER_PARTICIPANTS',category:'传输'},
  VIRTUAL_GROUP:{title:'虚拟组',description:'读取虚拟组状态、标识与已分配成员。',subject:'TRANSFER / VIRTUAL_GROUP',category:'传输'},
  TRANSFER_QOS:{title:'传输 QoS',description:'读取传输级 QoS Boost 的当前状态。',subject:'TRANSFER',category:'传输'},
};

export const operationMetaEn: Record<string, CapabilityMeta> = {
  UE_REGISTRATION_ENSURE:{title:'Ensure UE registration',description:'Converges a seeded UE to registered state with materialized context.',subject:'UE',category:'Registration'},
  PDU_SESSION_CREATE:{title:'Create PDU session',description:'Creates a modeled PDU session using DNN and S-NSSAI parameters.',subject:'PDU_SESSION',category:'Session'},
  PDU_SESSION_MODIFY_QOS:{title:'Modify PDU session QoS',description:'Updates required 5QI and the default QoS flow of an established session.',subject:'PDU_SESSION',category:'Session'},
  PDU_SESSION_RELEASE:{title:'Release PDU session',description:'Releases an existing modeled PDU session through the PFCP-backed path.',subject:'PDU_SESSION',category:'Session'},
  PFCP_RESOURCE_CLEANUP:{title:'Clean up PFCP resource',description:'Targets an exact modeled PFCP resource for cleanup.',subject:'PFCP_RESOURCE',category:'PFCP'},
  EDGE_CACHE_ENSURE:{title:'Ensure edge cache',description:'Converges the transfer-scoped edge-cache resource to ready state.',subject:'TRANSFER',category:'Transfer'},
  EDGE_CACHE_RECONCILE:{title:'Reconcile edge cache',description:'Checks whether the transfer-scoped edge-cache resource committed.',subject:'TRANSFER',category:'Transfer / Reconcile'},
  VIRTUAL_GROUP_CREATE:{title:'Create virtual group',description:'Creates the deterministic transfer group after participant prerequisites hold.',subject:'TRANSFER',category:'Transfer'},
  VIRTUAL_GROUP_RECONCILE_CREATE:{title:'Reconcile group creation',description:'Checks whether the expected virtual group exists.',subject:'TRANSFER',category:'Transfer / Reconcile'},
  VIRTUAL_GROUP_ASSIGN_MEMBERS:{title:'Assign virtual-group members',description:'Assigns validated participant endpoints to an existing virtual group.',subject:'VIRTUAL_GROUP',category:'Transfer'},
  VIRTUAL_GROUP_RECONCILE_MEMBERS:{title:'Reconcile group members',description:'Checks that the expected member set is committed.',subject:'VIRTUAL_GROUP',category:'Transfer / Reconcile'},
  VIRTUAL_GROUP_RELEASE:{title:'Release virtual group',description:'Moves the target virtual group to released state.',subject:'VIRTUAL_GROUP',category:'Transfer'},
  VIRTUAL_GROUP_RECONCILE_RELEASE:{title:'Reconcile group release',description:'Checks that the virtual group is released or already absent.',subject:'VIRTUAL_GROUP',category:'Transfer / Reconcile'},
  TRANSFER_QOS_BOOST:{title:'Boost transfer QoS',description:'Commits the modeled transfer-level QoS boost.',subject:'TRANSFER',category:'Transfer'},
  TRANSFER_QOS_RECONCILE:{title:'Reconcile transfer QoS',description:'Checks that the transfer-level QoS boost committed.',subject:'TRANSFER',category:'Transfer / Reconcile'},
};

export const operationMetaZh: Record<string, CapabilityMeta> = {
  UE_REGISTRATION_ENSURE:{title:'确保 UE 已注册',description:'将已预置的 UE 收敛到 REGISTERED 状态，并建立对应注册上下文。',subject:'UE',category:'注册'},
  PDU_SESSION_CREATE:{title:'创建 PDU 会话',description:'使用 DNN 与 S-NSSAI 等参数创建模拟 PDU 会话。',subject:'PDU_SESSION',category:'会话'},
  PDU_SESSION_MODIFY_QOS:{title:'修改 PDU 会话 QoS',description:'更新已建立会话所需的 5QI 与默认 QoS Flow。',subject:'PDU_SESSION',category:'会话'},
  PDU_SESSION_RELEASE:{title:'释放 PDU 会话',description:'通过模拟的 PFCP 路径释放现有 PDU 会话。',subject:'PDU_SESSION',category:'会话'},
  PFCP_RESOURCE_CLEANUP:{title:'清理 PFCP 资源',description:'精确定位并清理指定的模拟 PFCP 资源。',subject:'PFCP_RESOURCE',category:'PFCP'},
  EDGE_CACHE_ENSURE:{title:'确保边缘缓存就绪',description:'将传输范围内的边缘缓存资源收敛到就绪状态。',subject:'TRANSFER',category:'传输'},
  EDGE_CACHE_RECONCILE:{title:'核对边缘缓存',description:'检查传输范围内的边缘缓存资源是否已经提交成功。',subject:'TRANSFER',category:'传输 / Reconcile'},
  VIRTUAL_GROUP_CREATE:{title:'创建虚拟组',description:'在参与方前置条件满足后创建确定性的传输虚拟组。',subject:'TRANSFER',category:'传输'},
  VIRTUAL_GROUP_RECONCILE_CREATE:{title:'核对虚拟组创建',description:'检查预期的虚拟组是否已经存在。',subject:'TRANSFER',category:'传输 / Reconcile'},
  VIRTUAL_GROUP_ASSIGN_MEMBERS:{title:'分配虚拟组成员',description:'把已验证的参与方端点分配给现有虚拟组。',subject:'VIRTUAL_GROUP',category:'传输'},
  VIRTUAL_GROUP_RECONCILE_MEMBERS:{title:'核对虚拟组成员',description:'检查预期成员集合是否已经正确提交。',subject:'VIRTUAL_GROUP',category:'传输 / Reconcile'},
  VIRTUAL_GROUP_RELEASE:{title:'释放虚拟组',description:'将目标虚拟组推进到已释放状态。',subject:'VIRTUAL_GROUP',category:'传输'},
  VIRTUAL_GROUP_RECONCILE_RELEASE:{title:'核对虚拟组释放',description:'检查虚拟组是否已释放，或已经不存在。',subject:'VIRTUAL_GROUP',category:'传输 / Reconcile'},
  TRANSFER_QOS_BOOST:{title:'提升传输 QoS',description:'提交模拟的传输级 QoS Boost。',subject:'TRANSFER',category:'传输'},
  TRANSFER_QOS_RECONCILE:{title:'核对传输 QoS',description:'检查传输级 QoS Boost 是否已经提交成功。',subject:'TRANSFER',category:'传输 / Reconcile'},
};

export function fallbackMeta(semantic:string,kind:'fact'|'operation',lang:'zh'|'en'='en'):CapabilityMeta {
  return lang==='zh'
    ? {title:semantic,description:`从上游权威 Schema 自动发现的新 ${kind==='fact'?'Fact':'Operation'} semantic。`,subject:'参见 Schema',category:'新上游能力'}
    : {title:semantic.replaceAll('_',' ').toLowerCase(),description:`Upstream ${kind} semantic discovered from the canonical schema.`,subject:'See schema',category:'New upstream capability'};
}
