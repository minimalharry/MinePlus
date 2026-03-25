function hasRole(member, roleId) {
  return Boolean(roleId && member?.roles?.cache?.has(roleId));
}

function isStaffMember(member, ticket, ticketSystem) {
  if (!member) return false;
  if (member.permissions?.has('ManageChannels')) return true;

  const roleCandidates = [
    ticket?.roleId,
    ticketSystem?.settings?.staffRoleId,
    ticketSystem?.settings?.fallbackStaffRoleId
  ].filter(Boolean);

  return roleCandidates.some(roleId => hasRole(member, roleId));
}

function canClaim(member, ticket, ticketSystem) {
  return isStaffMember(member, ticket, ticketSystem);
}

module.exports = {
  canClaim,
  isStaffMember
};
