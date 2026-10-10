export type CapabilityMeta = { title: string; description: string; subject: string; category: string; };

export const factMetaEn: Record<string, CapabilityMeta> = {
  UE_REGISTRATION:{title:'UE registration',description:'Reads the current registration state for a SUPI.',subject:'UE',category:'Registration'},
  UE_REGISTRATION_CONTEXT:{title:'Registration context',description:'Reads the UE registration context and its consistency state.',subject:'UE',category:'Registration'},
  PDU_SESSION:{title:'PDU session',description:'Reads PDU session state, DNN, S-NSSAI, QoS, and user-plane details.',subject:'PDU_SESSION',category:'Session'},
  USER_PLANE_CONNECTIVITY:{title:'User-plane connectivity',description:'Checks whether user-plane connectivity is available for the PDU session.',subject:'PDU_SESSION',category:'User plane'},
  PFCP_RESOURCE:{title:'PFCP resource',description:'Reads PFCP resources and their current state.',subject:'PDU_SESSION',category:'PFCP'},
  TRANSFER_PARTICIPANTS:{title:'Transfer participants',description:'Checks whether transfer participants are ready and returns their endpoints.',subject:'TRANSFER_PARTICIPANTS',category:'Transfer'},
  VIRTUAL_GROUP:{title:'Virtual group',description:'Reads the virtual group state, ID, and members.',subject:'TRANSFER / VIRTUAL_GROUP',category:'Transfer'},
  TRANSFER_QOS:{title:'Transfer QoS',description:'Checks whether transfer QoS boost is active.',subject:'TRANSFER',category:'Transfer'},
};

export const factMetaZh: Record<string, CapabilityMeta> = {
  UE_REGISTRATION:{title:'UE 注册状态',description:'查看指定 SUPI 当前的注册状态。',subject:'UE',category:'注册'},
  UE_REGISTRATION_CONTEXT:{title:'注册上下文',description:'查看 UE 的注册上下文和一致性状态。',subject:'UE',category:'注册'},
  PDU_SESSION:{title:'PDU 会话',description:'查看 PDU Session 的状态、DNN、S-NSSAI、QoS 和用户面信息。',subject:'PDU_SESSION',category:'会话'},
  USER_PLANE_CONNECTIVITY:{title:'用户面连通性',description:'查看这个 PDU Session 的用户面是否连通。',subject:'PDU_SESSION',category:'用户面'},
  PFCP_RESOURCE:{title:'PFCP 资源',description:'查看 PFCP 资源及其当前状态。',subject:'PDU_SESSION',category:'PFCP'},
  TRANSFER_PARTICIPANTS:{title:'传输参与方',description:'查看传输双方是否就绪，以及对应的端点信息。',subject:'TRANSFER_PARTICIPANTS',category:'传输'},
  VIRTUAL_GROUP:{title:'虚拟组',description:'查看虚拟组的状态、ID 和成员。',subject:'TRANSFER / VIRTUAL_GROUP',category:'传输'},
  TRANSFER_QOS:{title:'传输 QoS',description:'查看传输 QoS Boost 当前是否生效。',subject:'TRANSFER',category:'传输'},
};

export const operationMetaEn: Record<string, CapabilityMeta> = {
  UE_REGISTRATION_ENSURE:{title:'Ensure UE registration',description:'Registers the UE if needed and creates its registration context.',subject:'UE',category:'Registration'},
  PDU_SESSION_CREATE:{title:'Create PDU session',description:'Creates a PDU session using DNN and S-NSSAI parameters.',subject:'PDU_SESSION',category:'Session'},
  PDU_SESSION_MODIFY_QOS:{title:'Modify PDU session QoS',description:'Updates 5QI and the default QoS flow on an existing PDU session.',subject:'PDU_SESSION',category:'Session'},
  PDU_SESSION_RELEASE:{title:'Release PDU session',description:'Releases an existing PDU session.',subject:'PDU_SESSION',category:'Session'},
  PFCP_RESOURCE_CLEANUP:{title:'Clean up PFCP resource',description:'Cleans up a specific PFCP resource.',subject:'PFCP_RESOURCE',category:'PFCP'},
  EDGE_CACHE_ENSURE:{title:'Ensure edge cache',description:'Makes sure the edge cache needed for this transfer is ready.',subject:'TRANSFER',category:'Transfer'},
  EDGE_CACHE_RECONCILE:{title:'Reconcile edge cache',description:'Checks whether the edge cache was actually created.',subject:'TRANSFER',category:'Transfer / Reconcile'},
  VIRTUAL_GROUP_CREATE:{title:'Create virtual group',description:'Creates the virtual group after the transfer participants are ready.',subject:'TRANSFER',category:'Transfer'},
  VIRTUAL_GROUP_RECONCILE_CREATE:{title:'Reconcile group creation',description:'Checks whether the virtual group was created.',subject:'TRANSFER',category:'Transfer / Reconcile'},
  VIRTUAL_GROUP_ASSIGN_MEMBERS:{title:'Assign virtual-group members',description:'Adds the transfer participants to an existing virtual group.',subject:'VIRTUAL_GROUP',category:'Transfer'},
  VIRTUAL_GROUP_RECONCILE_MEMBERS:{title:'Reconcile group members',description:'Checks whether the virtual-group members were updated.',subject:'VIRTUAL_GROUP',category:'Transfer / Reconcile'},
  VIRTUAL_GROUP_RELEASE:{title:'Release virtual group',description:'Releases the target virtual group.',subject:'VIRTUAL_GROUP',category:'Transfer'},
  VIRTUAL_GROUP_RECONCILE_RELEASE:{title:'Reconcile group release',description:'Checks whether the virtual group has been released.',subject:'VIRTUAL_GROUP',category:'Transfer / Reconcile'},
  TRANSFER_QOS_BOOST:{title:'Boost transfer QoS',description:'Enables QoS boost for the transfer.',subject:'TRANSFER',category:'Transfer'},
  TRANSFER_QOS_RECONCILE:{title:'Reconcile transfer QoS',description:'Checks whether the QoS boost took effect.',subject:'TRANSFER',category:'Transfer / Reconcile'},
};

export const operationMetaZh: Record<string, CapabilityMeta> = {
  UE_REGISTRATION_ENSURE:{title:'确保 UE 已注册',description:'如果 UE 还没注册，就把它注册起来并建立注册上下文。',subject:'UE',category:'注册'},
  PDU_SESSION_CREATE:{title:'创建 PDU 会话',description:'按 DNN、S-NSSAI 等参数创建 PDU Session。',subject:'PDU_SESSION',category:'会话'},
  PDU_SESSION_MODIFY_QOS:{title:'修改 PDU 会话 QoS',description:'修改已建立 PDU Session 的 5QI 和默认 QoS Flow。',subject:'PDU_SESSION',category:'会话'},
  PDU_SESSION_RELEASE:{title:'释放 PDU 会话',description:'释放已有的 PDU Session。',subject:'PDU_SESSION',category:'会话'},
  PFCP_RESOURCE_CLEANUP:{title:'清理 PFCP 资源',description:'清理指定的 PFCP 资源。',subject:'PFCP_RESOURCE',category:'PFCP'},
  EDGE_CACHE_ENSURE:{title:'确保边缘缓存就绪',description:'确保这次传输需要的边缘缓存已经就绪。',subject:'TRANSFER',category:'传输'},
  EDGE_CACHE_RECONCILE:{title:'核对边缘缓存',description:'检查边缘缓存是否真的创建成功。',subject:'TRANSFER',category:'传输 / Reconcile'},
  VIRTUAL_GROUP_CREATE:{title:'创建虚拟组',description:'在传输双方准备好后创建虚拟组。',subject:'TRANSFER',category:'传输'},
  VIRTUAL_GROUP_RECONCILE_CREATE:{title:'核对虚拟组创建',description:'检查虚拟组是否已经创建。',subject:'TRANSFER',category:'传输 / Reconcile'},
  VIRTUAL_GROUP_ASSIGN_MEMBERS:{title:'分配虚拟组成员',description:'把传输双方加入已有的虚拟组。',subject:'VIRTUAL_GROUP',category:'传输'},
  VIRTUAL_GROUP_RECONCILE_MEMBERS:{title:'核对虚拟组成员',description:'检查虚拟组成员是否已经更新。',subject:'VIRTUAL_GROUP',category:'传输 / Reconcile'},
  VIRTUAL_GROUP_RELEASE:{title:'释放虚拟组',description:'释放指定虚拟组。',subject:'VIRTUAL_GROUP',category:'传输'},
  VIRTUAL_GROUP_RECONCILE_RELEASE:{title:'核对虚拟组释放',description:'检查虚拟组是否已经释放。',subject:'VIRTUAL_GROUP',category:'传输 / Reconcile'},
  TRANSFER_QOS_BOOST:{title:'提升传输 QoS',description:'打开这次传输的 QoS Boost。',subject:'TRANSFER',category:'传输'},
  TRANSFER_QOS_RECONCILE:{title:'核对传输 QoS',description:'检查 QoS Boost 是否真的生效。',subject:'TRANSFER',category:'传输 / Reconcile'},
};

export function fallbackMeta(semantic:string,kind:'fact'|'operation',lang:'zh'|'en'='en'):CapabilityMeta {
  return lang==='zh'
    ? {title:semantic,description:`从上游权威 Schema 自动发现的新 ${kind==='fact'?'Fact':'Operation'} semantic。`,subject:'参见 Schema',category:'新上游能力'}
    : {title:semantic.replaceAll('_',' ').toLowerCase(),description:`Upstream ${kind} semantic discovered from the canonical schema.`,subject:'See schema',category:'New upstream capability'};
}
