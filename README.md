## Local provider

Test locally! Have a local strider instance test every commit you make.

## Usage:

- Install in strider: `npm install strider-local` within the strider directory.
- Install globally `npm install -g strider-local`

Then from within any local git repository, you can run `strider-local`, and it
will create a new project in strider and add a `post-commit` hook to your
repository, such that whenever you commit, your local strider box will test
your code!

To remove both the project and the post-commit hook, run the
`.git/remove-strider` script.

### Security

This should only be used on your local box; in its current form, strider-local
*will store your username and password* in a local file. So only run this with a
local strider instance, with a dummy username and password that you don't care
about.

In the future, strider will implement Hawk, and this security concern should
be mitigated.

