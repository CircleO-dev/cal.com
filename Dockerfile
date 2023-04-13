FROM node:16 as builder

WORKDIR /calcom
ARG NEXT_PUBLIC_LICENSE_CONSENT=true
ARG CALCOM_TELEMETRY_DISABLED
ARG DATABASE_URL
ARG NEXT_PUBLIC_WEBAPP_URL='https://cal.circleo.me'
ARG NEXTAUTH_SECRET=wY9rmS46ilwVzqs81hwwOd0bs49IG+LdleoXRGuj3U8=
ARG CALENDSO_ENCRYPTION_KEY=AP5Ud//I1SfmkHcLEURrmxRRXX/m1vl5
ARG MAX_OLD_SPACE_SIZE=4096

ENV NEXT_PUBLIC_WEBAPP_URL=${NEXT_PUBLIC_WEBAPP_URL} \
    NEXT_PUBLIC_LICENSE_CONSENT=$NEXT_PUBLIC_LICENSE_CONSENT \
    CALCOM_TELEMETRY_DISABLED=$CALCOM_TELEMETRY_DISABLED \
    DATABASE_URL=$DATABASE_URL \
    NEXTAUTH_SECRET=${NEXTAUTH_SECRET} \
    CALENDSO_ENCRYPTION_KEY=${CALENDSO_ENCRYPTION_KEY} \
    NODE_OPTIONS=--max-old-space-size=${MAX_OLD_SPACE_SIZE}

COPY package.json yarn.lock turbo.json .env.appStore git-init.sh git-setup.sh ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN yarn global add turbo && \
    yarn config set network-timeout 1000000000 -g && \
    turbo prune --scope=@calcom/web --docker && \
    yarn install

RUN yarn turbo run build --filter=@calcom/web
RUN cd packages/prisma && \
    yarn seed-app-store

FROM node:16 as runner

WORKDIR /calcom
ARG NEXT_PUBLIC_WEBAPP_URL='https://cal.circleo.me'

ENV NODE_ENV production

RUN apt-get update && \
    apt-get -y install netcat && \
    rm -rf /var/lib/apt/lists/* && \
    npm install --global prisma

COPY package.json yarn.lock turbo.json ./
COPY --from=builder /calcom/node_modules ./node_modules
COPY --from=builder /calcom/packages ./packages
COPY --from=builder /calcom/apps/web ./apps/web
COPY --from=builder /calcom/.env.appStore ./.env.appStore
COPY --from=builder /calcom/packages/prisma/schema.prisma ./prisma/schema.prisma
COPY scripts scripts

# Save value used during this build stage. If NEXT_PUBLIC_WEBAPP_URL and BUILT_NEXT_PUBLIC_WEBAPP_URL differ at
# run-time, then start.sh will find/replace static values again.
ENV NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL \
    BUILT_NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL

RUN chmod -R 777 scripts
RUN scripts/replace-placeholder.sh http://NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER ${NEXT_PUBLIC_WEBAPP_URL}

EXPOSE 3000
CMD ["/calcom/scripts/start.sh"]
