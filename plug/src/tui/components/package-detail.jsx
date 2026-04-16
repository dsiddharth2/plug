import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getClaudeDirForType } from '../../utils/paths.js';

/**
 * Full detail panel for a single package. Shown when Enter is pressed on a list item.
 * Esc returns to the list. 'i' triggers install.
 *
 * @param {{
 *   pkg: object,
 *   onBack: () => void,
 *   onInstall: (pkg: object) => void,
 *   isInstalled?: boolean,
 * }} props
 */
export default function PackageDetail({ pkg, onBack, onInstall, installedNames = new Set() }) {
  const isInstalled = installedNames.has(pkg.name);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
    if (input === 'i' && !isInstalled) {
      onInstall(pkg);
    }
  });

  const installPath = getClaudeDirForType(pkg.type, false);
  const typeColor = pkg.type === 'agent' ? 'yellow' : pkg.type === 'skill' ? 'blue' : 'magenta';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="green">{pkg.name}</Text>
        <Text> </Text>
        <Text color={typeColor}>[{pkg.type}]</Text>
        {isInstalled && <Text color="green"> ✓ installed</Text>}
      </Box>

      {/* Description */}
      {pkg.description ? (
        <Box marginBottom={1}>
          <Text>{pkg.description}</Text>
        </Box>
      ) : null}

      {/* Metadata */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Version : </Text>
          <Text>{pkg.version || '?'}</Text>
        </Box>
        <Box>
          <Text dimColor>Vault   : </Text>
          <Text>{pkg.vault}</Text>
        </Box>
        {pkg.tags && pkg.tags.length > 0 && (
          <Box>
            <Text dimColor>Tags    : </Text>
            <Text>{pkg.tags.join(', ')}</Text>
          </Box>
        )}
        {pkg.path && (
          <Box>
            <Text dimColor>Path    : </Text>
            <Text dimColor>{pkg.path}</Text>
          </Box>
        )}
        <Box>
          <Text dimColor>Install → </Text>
          <Text dimColor>{installPath}</Text>
        </Box>
      </Box>

      {pkg.dependencies?.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Dependencies:</Text>
          {pkg.dependencies.map(dep => (
            <Box key={dep.name} paddingLeft={2}>
              <Text dimColor>{dep.required ? '•' : '○'} </Text>
              <Text>{dep.name}</Text>
              <Text dimColor> ({dep.vault})</Text>
              {installedNames.has(dep.name)
                ? <Text color="green">  ✓ installed</Text>
                : <Text dimColor>  not installed</Text>}
            </Box>
          ))}
          {pkg.dependencies.filter(d => d.required && !installedNames.has(d.name)).length > 0 && (
            <Box marginTop={1}>
              <Text dimColor>Installing this will also install: </Text>
              <Text>
                {pkg.dependencies
                  .filter(d => d.required && !installedNames.has(d.name))
                  .map(d => d.name)
                  .join(', ')}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Usage hint */}
      {isInstalled ? (
        <Box marginBottom={1}>
          <Text color="green">Already installed. </Text>
          <Text dimColor>{usageHint(pkg)}</Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text bold color="cyan">[i]</Text>
          <Text> Install this package</Text>
        </Box>
      )}

      {/* Back hint */}
      <Box>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  );
}

function usageHint(pkg) {
  if (pkg.type === 'command') return `Use /${pkg.name} to run the command`;
  if (pkg.type === 'agent') return `The agent '${pkg.name}' is available for delegation`;
  return `The skill '${pkg.name}' is active in your Claude project`;
}
