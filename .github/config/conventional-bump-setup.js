const COMMIT_TYPES = {
  breaking: 'major',
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
  build: 'patch',
  chore: 'patch',
  refactor: 'patch',
  docs: null,
  style: null,
  test: null,
  ci: null,
};

const RELEASE_TYPES = {
  0: 'MAJOR',
  1: 'MINOR',
  2: 'PATCH',
};

const config = {
  whatBump: commits => {
    let level = null;
    let breakingCount = 0;
    let featureCount = 0;
    let patchCount = 0;

    commits.forEach(commit => {
      // commit message validation
      const locations = [commit.body, commit.subject, commit.footer];
      const notesTitles = (commit.notes || []).map(note => note.title);
      const hasBreakingChangeText = [...locations, ...notesTitles].some(text => text?.includes('BREAKING CHANGE'));

      if (hasBreakingChangeText) {
        console.error('Breaking change text found in commit');
        breakingCount++;
        return; // if has breaking change, no need to check semantic commit type
      }

      // semantic commit type validation
      const commitTypeValue = COMMIT_TYPES[commit.type];
      console.error(`Evaluating commit type value: ${commitTypeValue}`);

      switch (commitTypeValue) {
        case 'major':
          console.error('Incrementing breaking count');
          breakingCount++;
          break;
        case 'minor':
          console.error('Incrementing feature count');
          featureCount++;
          break;
        case 'patch':
          console.error('Incrementing patch count');
          patchCount++;
          break;
        default:
          console.error(`Skipping commit type ${commit.type} with value ${commitTypeValue}`);
      }
    });

    if (breakingCount > 0) {
      level = 0;
    } else if (featureCount > 0) {
      level = 1;
    } else if (patchCount > 0) {
      level = 2;
    }

    const summary = `There are ${breakingCount} breaking changes, ${featureCount} features, and ${patchCount} patches`;
    const releaseMsg = level === null ? 'No version bump needed.' : `Bumping ${RELEASE_TYPES[level]} version.`;
    const reason = `${summary}. ${releaseMsg}`;

    console.warn(reason);

    return {
      level,
      reason,
    };
  },
};

module.exports = config;
