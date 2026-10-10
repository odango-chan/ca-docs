export type CapabilityMeta = {
  title: string;
  description: string;
  subject: string;
  category: string;
};

export const factMeta: Record<string, CapabilityMeta> = {
  UE_REGISTRATION: {
    title: 'UE registration',
    description: 'Reads authoritative registration-management state for a SUPI.',
    subject: 'UE',
    category: 'Registration',
  },
  UE_REGISTRATION_CONTEXT: {
    title: 'Registration context',
    description: 'Reads registration-context state and consistency.',
    subject: 'UE',
    category: 'Registration',
  },
  PDU_SESSION: {
    title: 'PDU session',
    description: 'Reads session lifecycle, DNN, S-NSSAI, QoS and user-plane state.',
    subject: 'PDU_SESSION',
    category: 'Session',
  },
  USER_PLANE_CONNECTIVITY: {
    title: 'User-plane connectivity',
    description: 'Reads whether the modeled user plane is currently available.',
    subject: 'PDU_SESSION',
    category: 'User plane',
  },
  PFCP_RESOURCE: {
    title: 'PFCP resource',
    description: 'Reads modeled PFCP resources and their lifecycle state.',
    subject: 'PDU_SESSION',
    category: 'PFCP',
  },
  TRANSFER_PARTICIPANTS: {
    title: 'Transfer participants',
    description: 'Resolves whether transfer participants are ready and exposes their endpoints.',
    subject: 'TRANSFER_PARTICIPANTS',
    category: 'Transfer',
  },
  VIRTUAL_GROUP: {
    title: 'Virtual group',
    description: 'Reads virtual-group state, identity and assigned members.',
    subject: 'TRANSFER / VIRTUAL_GROUP',
    category: 'Transfer',
  },
  TRANSFER_QOS: {
    title: 'Transfer QoS',
    description: 'Reads the transfer-level QoS boost state.',
    subject: 'TRANSFER',
    category: 'Transfer',
  },
};

export const operationMeta: Record<string, CapabilityMeta> = {
  UE_REGISTRATION_ENSURE: {
    title: 'Ensure UE registration',
    description: 'Converges a seeded UE to registered state with materialized context.',
    subject: 'UE',
    category: 'Registration',
  },
  PDU_SESSION_CREATE: {
    title: 'Create PDU session',
    description: 'Creates a modeled PDU session using DNN and S-NSSAI parameters.',
    subject: 'PDU_SESSION',
    category: 'Session',
  },
  PDU_SESSION_MODIFY_QOS: {
    title: 'Modify PDU session QoS',
    description: 'Updates required 5QI and the default QoS flow of an established session.',
    subject: 'PDU_SESSION',
    category: 'Session',
  },
  PDU_SESSION_RELEASE: {
    title: 'Release PDU session',
    description: 'Releases an existing modeled PDU session through the PFCP-backed path.',
    subject: 'PDU_SESSION',
    category: 'Session',
  },
  PFCP_RESOURCE_CLEANUP: {
    title: 'Clean up PFCP resource',
    description: 'Targets an exact modeled PFCP resource for cleanup.',
    subject: 'PFCP_RESOURCE',
    category: 'PFCP',
  },
  EDGE_CACHE_ENSURE: {
    title: 'Ensure edge cache',
    description: 'Converges the transfer-scoped edge-cache resource to ready state.',
    subject: 'TRANSFER',
    category: 'Transfer',
  },
  EDGE_CACHE_RECONCILE: {
    title: 'Reconcile edge cache',
    description: 'Checks whether the transfer-scoped edge-cache resource committed.',
    subject: 'TRANSFER',
    category: 'Transfer / Reconcile',
  },
  VIRTUAL_GROUP_CREATE: {
    title: 'Create virtual group',
    description: 'Creates the deterministic transfer group after participant prerequisites hold.',
    subject: 'TRANSFER',
    category: 'Transfer',
  },
  VIRTUAL_GROUP_RECONCILE_CREATE: {
    title: 'Reconcile group creation',
    description: 'Checks whether the expected virtual group exists.',
    subject: 'TRANSFER',
    category: 'Transfer / Reconcile',
  },
  VIRTUAL_GROUP_ASSIGN_MEMBERS: {
    title: 'Assign virtual-group members',
    description: 'Assigns validated participant endpoints to an existing virtual group.',
    subject: 'VIRTUAL_GROUP',
    category: 'Transfer',
  },
  VIRTUAL_GROUP_RECONCILE_MEMBERS: {
    title: 'Reconcile group members',
    description: 'Checks that the expected member set is committed.',
    subject: 'VIRTUAL_GROUP',
    category: 'Transfer / Reconcile',
  },
  VIRTUAL_GROUP_RELEASE: {
    title: 'Release virtual group',
    description: 'Moves the target virtual group to released state.',
    subject: 'VIRTUAL_GROUP',
    category: 'Transfer',
  },
  VIRTUAL_GROUP_RECONCILE_RELEASE: {
    title: 'Reconcile group release',
    description: 'Checks that the virtual group is released or already absent.',
    subject: 'VIRTUAL_GROUP',
    category: 'Transfer / Reconcile',
  },
  TRANSFER_QOS_BOOST: {
    title: 'Boost transfer QoS',
    description: 'Commits the modeled transfer-level QoS boost.',
    subject: 'TRANSFER',
    category: 'Transfer',
  },
  TRANSFER_QOS_RECONCILE: {
    title: 'Reconcile transfer QoS',
    description: 'Checks that the transfer-level QoS boost committed.',
    subject: 'TRANSFER',
    category: 'Transfer / Reconcile',
  },
};

export function fallbackMeta(semantic: string, kind: 'fact' | 'operation'): CapabilityMeta {
  return {
    title: semantic.replaceAll('_', ' ').toLowerCase(),
    description: `Upstream ${kind} semantic discovered from the canonical schema.`,
    subject: 'See schema',
    category: 'New upstream capability',
  };
}
